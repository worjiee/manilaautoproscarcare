"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bike,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  getLiveServiceAvailabilityAction,
  submitBookingReservationAction,
} from "@/app/actions/booking-actions";
import {
  BRAND_CONFIG,
  SERVICE_CATEGORIES,
  getServiceBySlug,
  type VehicleType,
} from "@/lib/constants/site-data";
import {
  formatManilaDate,
  getUpcomingManilaDates,
  isSundayInManila,
  type BookingDraft,
} from "@/lib/booking/mock-availability";
import type {
  AvailabilityQueryResult,
  BookingSuccess,
  TimeSlotOption,
} from "@/lib/booking/types";

const STEPS = [
  { number: 1, title: "Vehicle Type", shortTitle: "Vehicle" },
  { number: 2, title: "Service Selection", shortTitle: "Service" },
  { number: 3, title: "Vehicle Information", shortTitle: "Details" },
  { number: 4, title: "Appointment Schedule", shortTitle: "Schedule" },
  { number: 5, title: "Customer Information", shortTitle: "Contact" },
  { number: 6, title: "Review & Reserve", shortTitle: "Review" },
] as const;

type StepNumber = (typeof STEPS)[number]["number"];

function createClientIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `idem-${crypto.randomUUID()}`;
  }
  return `idem-${Math.random().toString(36).slice(2)}-${ Math.random().toString(36).slice(2)}`;
}

export function BookingWizard() {
  const searchParams = useSearchParams();
  const stepContainerRef = useRef<HTMLDivElement>(null);

  // Initialize from URL query parameters if valid
  const initialServiceSlug = searchParams.get("service") ?? "";
  const matchedInitialService = getServiceBySlug(initialServiceSlug);
  const paramVehicle = searchParams.get("vehicle");
  const initialVehicleType: VehicleType | "" =
    paramVehicle === "Car" || paramVehicle === "Motorcycle"
      ? paramVehicle
      : matchedInitialService
      ? matchedInitialService.vehicleTypes[0]
      : "";

  const initialOptionParam = searchParams.get("option") ?? "";
  const initialOptionId =
    matchedInitialService?.items.find((i) => i.id === initialOptionParam)?.id ??
    matchedInitialService?.items[0]?.id ??
    "";

  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [returnToReview, setReturnToReview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    createClientIdempotencyKey()
  );

  const [draft, setDraft] = useState<BookingDraft>({
    vehicleType: initialVehicleType,
    serviceCategorySlug: matchedInitialService?.slug ?? "",
    serviceOptionId: initialOptionId,
    manufacturer: "",
    model: "",
    year: "",
    vehicleNotes: "",
    appointmentDate: "",
    timeSlotId: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    additionalRequests: "",
  });

  const upcomingDates = useMemo(() => getUpcomingManilaDates(14), []);
  const [availabilityMeta, setAvailabilityMeta] =
    useState<AvailabilityQueryResult | null>(null);
  const [slots, setSlots] = useState<TimeSlotOption[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const requestCounterRef = useRef(0);

  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const [completedBooking, setCompletedBooking] =
    useState<BookingSuccess | null>(null);

  const loadAvailabilityForDateAndOption = async (
    dateStr: string,
    optionSlug: string
  ) => {
    if (!dateStr || !optionSlug) {
      setSlots([]);
      setAvailabilityMeta(null);
      setIsLoadingSlots(false);
      return;
    }

    if (isSundayInManila(dateStr)) {
      setSlots([]);
      setAvailabilityMeta(null);
      setIsLoadingSlots(false);
      setErrors((prev) => ({
        ...prev,
        appointmentDate:
          "Sunday is closed. Please select a Monday through Saturday date.",
      }));
      return;
    }

    const reqId = ++requestCounterRef.current;
    setIsLoadingSlots(true);
    const res = await getLiveServiceAvailabilityAction({
      dateStr,
      optionSlug,
    });
    if (reqId === requestCounterRef.current) {
      setAvailabilityMeta(res);
      setSlots(res.slots);
      setIsLoadingSlots(false);

      if (res.isDayBlocked && res.blockedReason) {
        setErrors((prev) => ({
          ...prev,
          appointmentDate: `Selected date is unavailable: ${res.blockedReason}`,
        }));
      } else if (res.isOutOfAdvanceWindow && res.blockedReason) {
        setErrors((prev) => ({
          ...prev,
          appointmentDate: res.blockedReason ?? "Date is outside booking window.",
        }));
      }
    }
  };

  const handleSelectDate = async (dateStr: string) => {
    updateField("appointmentDate", dateStr);
    updateField("timeSlotId", "");
    setSubmitError(null);
    await loadAvailabilityForDateAndOption(dateStr, draft.serviceOptionId);
  };

  const availableCategories = useMemo(() => {
    if (!draft.vehicleType) return SERVICE_CATEGORIES;
    return SERVICE_CATEGORIES.filter((cat) =>
      cat.vehicleTypes.includes(draft.vehicleType as VehicleType)
    );
  }, [draft.vehicleType]);

  const selectedCategory = useMemo(
    () => getServiceBySlug(draft.serviceCategorySlug),
    [draft.serviceCategorySlug]
  );

  const selectedOption = useMemo(
    () =>
      selectedCategory?.items.find((item) => item.id === draft.serviceOptionId),
    [selectedCategory, draft.serviceOptionId]
  );

  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === draft.timeSlotId),
    [slots, draft.timeSlotId]
  );

  const updateField = <K extends keyof BookingDraft>(
    key: K,
    value: BookingDraft[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateStep = (step: StepNumber): boolean => {
    const nextErrors: Record<string, string> = {};

    if (step === 1) {
      if (!draft.vehicleType) {
        nextErrors.vehicleType =
          "Please select a vehicle type (Car or Motorcycle) to continue.";
      }
    }

    if (step === 2) {
      if (!draft.serviceCategorySlug) {
        nextErrors.serviceCategorySlug = "Please select a service category.";
      }
      if (!draft.serviceOptionId) {
        nextErrors.serviceOptionId =
          "Please select a specific service treatment option.";
      }
    }

    if (step === 3) {
      if (!draft.manufacturer.trim()) {
        nextErrors.manufacturer =
          "Vehicle manufacturer / make is required (e.g., Toyota, Porsche, Ducati).";
      }
      if (!draft.model.trim()) {
        nextErrors.model =
          "Vehicle model is required (e.g., GR Yaris, 911, Panigale V4).";
      }
      const trimmedYear = draft.year.trim();
      const yearNum = Number(trimmedYear);
      if (
        !trimmedYear ||
        !/^\d{4}$/.test(trimmedYear) ||
        yearNum < 1950 ||
        yearNum > 2027
      ) {
        nextErrors.year = "Please enter a valid 4-digit model year (1950–2027).";
      }
    }

    if (step === 4) {
      if (!draft.appointmentDate) {
        nextErrors.appointmentDate =
          "Please choose a preferred appointment date.";
      } else if (isSundayInManila(draft.appointmentDate)) {
        nextErrors.appointmentDate =
          "Manila Auto Pros is closed on Sundays. Please select a Monday through Saturday date.";
      } else if (availabilityMeta?.isDayBlocked) {
        nextErrors.appointmentDate =
          availabilityMeta.blockedReason ?? "Selected date is blocked.";
      }
      if (!draft.timeSlotId) {
        nextErrors.timeSlotId =
          "Please select an available appointment start window.";
      }
    }

    if (step === 5) {
      if (draft.customerName.trim().length < 2) {
        nextErrors.customerName = "Please enter your full name.";
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(draft.customerEmail.trim())) {
        nextErrors.customerEmail = "Please enter a valid email address.";
      }
      const digitsOnly = draft.customerPhone.replace(/\D/g, "");
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        nextErrors.customerPhone =
          "Please enter a valid mobile number (at least 10 digits).";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    if (returnToReview && currentStep < 6) {
      setReturnToReview(false);
      setCurrentStep(6);
    } else if (currentStep < 6) {
      const nextStep = (currentStep + 1) as StepNumber;
      setCurrentStep(nextStep);
      if (nextStep === 4 && draft.appointmentDate && draft.serviceOptionId) {
        void loadAvailabilityForDateAndOption(
          draft.appointmentDate,
          draft.serviceOptionId
        );
      }
    }
    stepContainerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleBack = () => {
    setErrors({});
    setSubmitError(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as StepNumber);
      stepContainerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const jumpToStepForEdit = (targetStep: StepNumber) => {
    setErrors({});
    setSubmitError(null);
    setReturnToReview(true);
    setCurrentStep(targetStep);
    if (targetStep === 4 && draft.appointmentDate && draft.serviceOptionId) {
      void loadAvailabilityForDateAndOption(
        draft.appointmentDate,
        draft.serviceOptionId
      );
    }
    stepContainerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleSubmitBooking = async () => {
    if (isSubmitting) return;
    setSubmitError(null);

    if (!draft.vehicleType) {
      jumpToStepForEdit(1);
      return;
    }

    setIsSubmitting(true);
    const result = await submitBookingReservationAction({
      idempotencyKey,
      vehicleType: draft.vehicleType,
      serviceOptionSlug: draft.serviceOptionId,
      manufacturer: draft.manufacturer,
      model: draft.model,
      year: Number(draft.year),
      vehicleNotes: draft.vehicleNotes,
      appointmentDate: draft.appointmentDate,
      startTimeLocal: draft.timeSlotId,
      customerName: draft.customerName,
      customerEmail: draft.customerEmail,
      customerPhone: draft.customerPhone,
      additionalRequests: draft.additionalRequests,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      }
      setSubmitError({
        code: result.errorCode,
        message: result.message,
      });
      // Rotate idempotency key if slot was taken or validation failed so user can pick a new slot and submit cleanly
      if (
        result.errorCode === "SLOT_CAPACITY_EXHAUSTED" ||
        result.errorCode === "DATE_BLOCKED" ||
        result.errorCode === "VALIDATION_ERROR"
      ) {
        setIdempotencyKey(createClientIdempotencyKey());
      }
      return;
    }

    setCompletedBooking(result);
    stepContainerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleStartNewBooking = () => {
    setCompletedBooking(null);
    setSubmitError(null);
    setErrors({});
    setIdempotencyKey(createClientIdempotencyKey());
    setDraft((prev) => ({
      ...prev,
      appointmentDate: "",
      timeSlotId: "",
      additionalRequests: "",
    }));
    setSlots([]);
    setCurrentStep(1);
  };

  /* ========================================================================
     POST-SUBMISSION OUTCOME SCREEN (CONFIRMED vs PENDING ADMIN APPROVAL)
  ======================================================================== */
  if (completedBooking) {
    const { booking, tokens, backendMode } = completedBooking;
    const isConfirmed = booking.status === "confirmed";

    return (
      <div
        ref={stepContainerRef}
        className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16"
      >
        <div className="border border-[#292929] bg-[#141414] p-6 sm:p-10">
          {/* Status Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#292929] pb-6">
            <div>
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 font-mono text-xs font-bold tracking-wider uppercase ${
                  isConfirmed
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40"
                    : "bg-amber-500/15 text-amber-300 border border-amber-500/40"
                }`}
              >
                {isConfirmed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Status: Confirmed Reservation
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    Status: Pending Admin Approval (Slot Held)
                  </>
                )}
              </span>

              <h2 className="mt-4 font-display text-3xl font-extrabold tracking-wide text-white uppercase sm:text-5xl">
                {isConfirmed
                  ? "Appointment Confirmed"
                  : "Appointment Request Received — Pending Approval"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#A3A3A3]">
                {isConfirmed
                  ? "Your studio bay allocation has been locked in our scheduling engine."
                  : "Your requested studio bay window is temporarily held while awaiting administrator review. Please note that a pending request is NOT a final confirmation until approved by Manila Auto Pros."}
              </p>
            </div>

            <div className="border border-[#292929] bg-[#090909] p-4 text-right">
              <p className="font-mono text-[10px] tracking-widest text-[#A3A3A3] uppercase">
                Booking Reference
              </p>
              <p className="mt-1 font-mono text-lg font-bold tracking-wider text-[#E11D2E]">
                {booking.referenceCode}
              </p>
            </div>
          </div>

          {/* Pending Expiration Hold Alert */}
          {!isConfirmed && booking.pendingExpiresAt && (
            <div className="mt-6 border border-amber-500/40 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-200">
              <p className="font-mono font-bold tracking-wider uppercase">
                Multi-Hour / Specialty Service Approval Policy
              </p>
              <p className="mt-1">
                Because <strong>{booking.serviceName}</strong> requires{" "}
                <strong>{booking.allocatedUnits} studio bay unit(s)</strong> for{" "}
                <strong>{booking.durationMinutes} minutes</strong>, an
                administrator must verify bay readiness. Your slot hold is
                protected until{" "}
                <strong className="font-mono">
                  {new Date(booking.pendingExpiresAt).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  PHT
                </strong>
                .
              </p>
            </div>
          )}

          {/* Reservation Details Grid */}
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="border border-[#292929] bg-[#090909] p-5">
              <h3 className="font-mono text-xs font-semibold tracking-wider text-[#E11D2E] uppercase">
                Service &amp; Vehicle Allocation
              </h3>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#A3A3A3]">Treatment:</dt>
                  <dd className="font-semibold text-white text-right">
                    {booking.serviceName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#A3A3A3]">Division:</dt>
                  <dd className="text-white text-right">
                    {booking.categoryTitle}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#A3A3A3]">Vehicle:</dt>
                  <dd className="font-semibold text-white text-right">
                    {booking.vehicleSummary}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#A3A3A3]">Studio Resource:</dt>
                  <dd className="font-mono text-xs text-white text-right">
                    {booking.resourceName} ({booking.allocatedUnits} unit
                    {booking.allocatedUnits > 1 ? "s" : ""})
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border border-[#292929] bg-[#090909] p-5">
              <h3 className="font-mono text-xs font-semibold tracking-wider text-[#E11D2E] uppercase">
                Schedule &amp; Studio Location
              </h3>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#A3A3A3]">Appointment Date:</dt>
                  <dd className="font-semibold text-white text-right">
                    {formatManilaDate(booking.appointmentDate)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#A3A3A3]">Time Window (PHT):</dt>
                  <dd className="font-mono font-semibold text-white text-right">
                    {booking.startTimeLocal} – {booking.endTimeLocal} (
                    {booking.durationMinutes} mins)
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#A3A3A3]">Approval Mode:</dt>
                  <dd className="font-mono text-xs text-white uppercase text-right">
                    {booking.confirmationMode === "auto"
                      ? "Automatic Confirmation"
                      : "Manual Admin Approval"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#A3A3A3]">Location:</dt>
                  <dd className="text-white text-right">
                    {BRAND_CONFIG.location.fullAddress}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Self-Service Token Management Links */}
          {tokens && (
            <div className="mt-8 border border-[#E11D2E]/50 bg-[#1C1C1C] p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#E11D2E]"
                  aria-hidden="true"
                />
                <div className="w-full">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-mono text-xs font-bold tracking-wider text-white uppercase">
                      Single-Purpose Self-Service Security Tokens
                    </h3>
                    <span className="border border-[#292929] bg-[#090909] px-2.5 py-0.5 font-mono text-[10px] text-[#A3A3A3] uppercase">
                      Engine: {backendMode}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#A3A3A3]">
                    Only SHA-256 hashes of these single-use tokens are stored in{" "}
                    <code className="text-white">booking_tokens</code>. In{" "}
                    <strong className="text-white">Phase 5 (Resend)</strong>,
                    these links will be delivered via email. You can use them
                    directly below to reschedule or cancel this reservation:
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/booking/manage?token=${encodeURIComponent(
                        tokens.rescheduleToken
                      )}&action=reschedule`}
                      className="inline-flex items-center gap-2 bg-[#E11D2E] px-5 py-2.5 font-display text-xs font-bold tracking-[0.14em] text-white uppercase transition-colors hover:bg-[#FF3045]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reschedule via Token</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>

                    <Link
                      href={`/booking/manage?token=${encodeURIComponent(
                        tokens.cancelToken
                      )}&action=cancel`}
                      className="inline-flex items-center gap-2 border border-[#292929] bg-[#090909] px-5 py-2.5 font-display text-xs font-bold tracking-[0.14em] text-white uppercase transition-colors hover:border-[#E11D2E]"
                    >
                      <XCircle
                        className="h-3.5 w-3.5 text-[#E11D2E]"
                        aria-hidden="true"
                      />
                      <span>Cancel via Token</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#292929] pt-6">
            <button
              type="button"
              onClick={handleStartNewBooking}
              className="inline-flex items-center gap-2 border border-[#292929] bg-[#090909] px-6 py-3.5 font-display text-sm font-bold tracking-[0.14em] text-white uppercase transition-colors hover:border-white/40"
            >
              <Calendar className="h-4 w-4 text-[#E11D2E]" aria-hidden="true" />
              <span>Book Another Vehicle</span>
            </button>

            <Link
              href="/services"
              className="font-mono text-xs font-semibold tracking-wider text-[#A3A3A3] uppercase hover:text-white"
            >
              Return to Services Directory &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={stepContainerRef}
      className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16"
    >
      {/* Phase 3 Real-Time Booking Engine Banner */}
      <div
        role="region"
        aria-label="Real-Time Booking Engine Status"
        className="mb-10 flex items-start gap-3.5 border border-[#E11D2E]/60 bg-[#141414] p-5 text-xs leading-relaxed text-[#A3A3A3]"
      >
        <Info
          className="mt-0.5 h-5 w-5 shrink-0 text-[#E11D2E]"
          aria-hidden="true"
        />
        <div>
          <p className="font-mono text-xs font-bold tracking-wider text-white uppercase">
            Real-Time Availability &amp; Atomic Reservation Engine (Asia/Manila)
          </p>
          <p className="mt-1">
            Slots are calculated dynamically against{" "}
            <strong className="text-white">Monday–Saturday</strong> operating
            windows, service-specific durations, and studio bay capacities.
            Unconfirmed shop parameters are marked as{" "}
            <strong className="text-white">Development Defaults</strong> until
            finalized by the studio.
          </p>
        </div>
      </div>

      {/* Progress Stepper */}
      <nav aria-label="Booking Progress" className="mb-10">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STEPS.map((step) => {
            const isCurrent = currentStep === step.number;
            const isCompleted = currentStep > step.number;

            return (
              <li
                key={step.number}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex items-center gap-3 border p-3 transition-colors ${
                  isCurrent
                    ? "border-[#E11D2E] bg-[#1C1C1C]"
                    : isCompleted
                    ? "border-[#292929] bg-[#141414]"
                    : "border-[#292929]/60 bg-[#090909] opacity-65"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center font-mono text-xs font-bold ${
                    isCurrent
                      ? "bg-[#E11D2E] text-white"
                      : isCompleted
                      ? "border border-[#E11D2E] text-[#E11D2E]"
                      : "border border-[#292929] text-[#A3A3A3]"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    `0${step.number}`
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] tracking-wider text-[#A3A3A3] uppercase">
                    Step 0{step.number}
                  </p>
                  <p className="truncate font-display text-sm font-bold tracking-wide text-white uppercase">
                    {step.shortTitle}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Main Step Card */}
      <div className="border border-[#292929] bg-[#141414] p-6 sm:p-10">
        {/* Step Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#292929] pb-6">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.2em] text-[#E11D2E] uppercase">
              Step 0{currentStep} of 06
            </p>
            <h2 className="mt-1 font-display text-3xl font-extrabold tracking-wide text-white uppercase sm:text-4xl">
              {STEPS[currentStep - 1].title}
            </h2>
          </div>
          <span className="border border-[#292929] bg-[#090909] px-3 py-1.5 font-mono text-[11px] text-[#A3A3A3] uppercase">
            Timezone: {BRAND_CONFIG.location.timezone}
          </span>
        </div>

        {/* ===============================================================
            STEP 1 — VEHICLE TYPE
        =============================================================== */}
        {currentStep === 1 && (
          <div className="mt-8">
            <fieldset>
              <legend className="text-sm text-[#A3A3A3]">
                Select the type of vehicle you are bringing to Manila Auto Pros.
                This filters the service catalog and studio bay pool to match
                your vehicle division.
              </legend>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {(
                  [
                    {
                      type: "Car" as VehicleType,
                      title: "Car / SUV / Pickup",
                      subtitle: "Automotive Division",
                      description:
                        "Paint Protection Film, Ceramic & Graphene Coating, Auto Detailing, and Automotive Window Tint.",
                      icon: Car,
                    },
                    {
                      type: "Motorcycle" as VehicleType,
                      title: "Motorcycle",
                      subtitle: "Moto Pros Division",
                      description:
                        "Motorcycle Ceramic & Graphene Coatings, PPF Installation, Detailing, and Paint Protection.",
                      icon: Bike,
                    },
                  ] as const
                ).map(({ type, title, subtitle, description, icon: Icon }) => {
                  const isSelected = draft.vehicleType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        const prevType = draft.vehicleType;
                        updateField("vehicleType", type);
                        if (prevType !== type) {
                          const firstMatchingCat = SERVICE_CATEGORIES.find(
                            (c) => c.vehicleTypes.includes(type)
                          );
                          updateField(
                            "serviceCategorySlug",
                            firstMatchingCat?.slug ?? ""
                          );
                          updateField(
                            "serviceOptionId",
                            firstMatchingCat?.items[0]?.id ?? ""
                          );
                          updateField("timeSlotId", "");
                        }
                      }}
                      className={`group flex flex-col justify-between border p-6 text-left transition-colors sm:p-8 ${
                        isSelected
                          ? "border-[#E11D2E] bg-[#1C1C1C]"
                          : "border-[#292929] bg-[#090909] hover:border-white/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex h-12 w-12 items-center justify-center border border-[#292929] bg-[#141414]">
                            <Icon
                              className="h-6 w-6 text-[#E11D2E]"
                              aria-hidden="true"
                            />
                          </span>
                          <span
                            className={`px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase ${
                              isSelected
                                ? "bg-[#E11D2E] text-white"
                                : "border border-[#292929] text-[#A3A3A3]"
                            }`}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </span>
                        </div>

                        <p className="mt-5 font-mono text-xs font-semibold tracking-wider text-[#E11D2E] uppercase">
                          {subtitle}
                        </p>
                        <h3 className="mt-1 font-display text-3xl font-extrabold tracking-wide text-white uppercase">
                          {title}
                        </h3>
                        <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">
                          {description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {errors.vehicleType && (
                <p
                  role="alert"
                  className="mt-4 flex items-center gap-2 text-xs font-medium text-[#FF3045]"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{errors.vehicleType}</span>
                </p>
              )}
            </fieldset>
          </div>
        )}

        {/* ===============================================================
            STEP 2 — SERVICE SELECTION
        =============================================================== */}
        {currentStep === 2 && (
          <div className="mt-8 space-y-8">
            <div>
              <label className="block font-mono text-xs font-semibold tracking-[0.18em] text-white uppercase">
                1. Choose Service Category ({draft.vehicleType || "All"})
              </label>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {availableCategories.map((cat) => {
                  const isSelected = draft.serviceCategorySlug === cat.slug;
                  return (
                    <button
                      key={cat.slug}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        const nextOptionId = cat.items[0]?.id ?? "";
                        updateField("serviceCategorySlug", cat.slug);
                        updateField("serviceOptionId", nextOptionId);
                        updateField("timeSlotId", "");
                      }}
                      className={`border p-5 text-left transition-colors ${
                        isSelected
                          ? "border-[#E11D2E] bg-[#1C1C1C]"
                          : "border-[#292929] bg-[#090909] hover:border-white/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-semibold text-[#E11D2E] uppercase">
                          {cat.kicker.split(" // ")[0]}
                        </span>
                        {isSelected && (
                          <span className="bg-[#E11D2E] px-2 py-0.5 font-mono text-[10px] font-bold text-white uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 font-display text-2xl font-bold tracking-wide text-white uppercase">
                        {cat.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#A3A3A3]">
                        {cat.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
              {errors.serviceCategorySlug && (
                <p
                  role="alert"
                  className="mt-3 flex items-center gap-2 text-xs font-medium text-[#FF3045]"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{errors.serviceCategorySlug}</span>
                </p>
              )}
            </div>

            {selectedCategory && (
              <div className="border-t border-[#292929] pt-6">
                <label className="block font-mono text-xs font-semibold tracking-[0.18em] text-white uppercase">
                  2. Choose Specific {selectedCategory.title} Option
                </label>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selectedCategory.items.map((item) => {
                    const isSelected = draft.serviceOptionId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          updateField("serviceOptionId", item.id);
                          updateField("timeSlotId", "");
                        }}
                        className={`flex flex-col justify-between border p-4 text-left transition-colors ${
                          isSelected
                            ? "border-[#E11D2E] bg-[#1C1C1C]"
                            : "border-[#292929] bg-[#090909] hover:border-white/40"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display text-lg font-bold tracking-wide text-white uppercase">
                              {item.name}
                            </span>
                            {isSelected && (
                              <Check
                                className="h-4 w-4 shrink-0 text-[#E11D2E]"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-[#A3A3A3]">
                            {item.shortDescription}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {errors.serviceOptionId && (
                  <p
                    role="alert"
                    className="mt-3 flex items-center gap-2 text-xs font-medium text-[#FF3045]"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{errors.serviceOptionId}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===============================================================
            STEP 3 — VEHICLE INFORMATION
        =============================================================== */}
        {currentStep === 3 && (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="booking-manufacturer"
                  className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
                >
                  Manufacturer / Make <span className="text-[#E11D2E]">*</span>
                </label>
                <input
                  id="booking-manufacturer"
                  type="text"
                  value={draft.manufacturer}
                  onChange={(e) => updateField("manufacturer", e.target.value)}
                  placeholder={
                    draft.vehicleType === "Motorcycle"
                      ? "e.g., Ducati, BMW, Yamaha"
                      : "e.g., Toyota, Porsche, BMW"
                  }
                  aria-invalid={Boolean(errors.manufacturer)}
                  aria-describedby={
                    errors.manufacturer ? "err-manufacturer" : undefined
                  }
                  className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
                />
                {errors.manufacturer && (
                  <p
                    id="err-manufacturer"
                    role="alert"
                    className="mt-2 text-xs text-[#FF3045]"
                  >
                    {errors.manufacturer}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="booking-model"
                  className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
                >
                  Model <span className="text-[#E11D2E]">*</span>
                </label>
                <input
                  id="booking-model"
                  type="text"
                  value={draft.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  placeholder={
                    draft.vehicleType === "Motorcycle"
                      ? "e.g., Panigale V4, S1000RR"
                      : "e.g., Land Cruiser, 911 Carrera"
                  }
                  aria-invalid={Boolean(errors.model)}
                  aria-describedby={errors.model ? "err-model" : undefined}
                  className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
                />
                {errors.model && (
                  <p
                    id="err-model"
                    role="alert"
                    className="mt-2 text-xs text-[#FF3045]"
                  >
                    {errors.model}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="booking-year"
                  className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
                >
                  Model Year <span className="text-[#E11D2E]">*</span>
                </label>
                <input
                  id="booking-year"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={draft.year}
                  onChange={(e) => updateField("year", e.target.value)}
                  placeholder="e.g., 2026"
                  aria-invalid={Boolean(errors.year)}
                  aria-describedby={errors.year ? "err-year" : undefined}
                  className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
                />
                {errors.year && (
                  <p
                    id="err-year"
                    role="alert"
                    className="mt-2 text-xs text-[#FF3045]"
                  >
                    {errors.year}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="booking-vehicle-notes"
                className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
              >
                Paint Condition / Vehicle Notes{" "}
                <span className="text-[#A3A3A3]">(Optional)</span>
              </label>
              <textarea
                id="booking-vehicle-notes"
                rows={3}
                value={draft.vehicleNotes}
                onChange={(e) => updateField("vehicleNotes", e.target.value)}
                placeholder="Mention paint color, current finish (gloss/matte), existing film or coating, or specific panels of concern."
                className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
              />
            </div>
          </div>
        )}

        {/* ===============================================================
            STEP 4 — APPOINTMENT SCHEDULE (ASIA/MANILA, MON-SAT)
        =============================================================== */}
        {currentStep === 4 && (
          <div className="mt-8 space-y-8">
            <div className="border border-[#292929] bg-[#090909] p-4 text-xs text-[#A3A3A3]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono font-semibold text-white uppercase">
                  Scheduling &amp; Resource Allocation Policy (
                  {BRAND_CONFIG.location.timezone})
                </p>
                {availabilityMeta?.isDevDefaultConfig && (
                  <span className="border border-[#E11D2E]/50 bg-[#1C1C1C] px-2 py-0.5 font-mono text-[10px] font-bold text-[#E11D2E] uppercase">
                    Dev Default Hours &amp; Durations
                  </span>
                )}
              </div>
              <p className="mt-1">
                Operating days:{" "}
                <strong className="text-white">
                  {BRAND_CONFIG.schedule.operatingDays}
                </strong>{" "}
                ({BRAND_CONFIG.schedule.closedDays}). Selected service:{" "}
                <strong className="text-white">
                  {selectedOption?.name ?? draft.serviceOptionId}
                </strong>
                {availabilityMeta && availabilityMeta.durationMinutes > 0 && (
                  <>
                    {" "}
                    • Duration:{" "}
                    <strong className="text-white">
                      {availabilityMeta.durationMinutes} mins
                    </strong>{" "}
                    • Resource:{" "}
                    <strong className="text-white">
                      {availabilityMeta.resourceName} (
                      {availabilityMeta.requiredUnits} bay unit
                      {availabilityMeta.requiredUnits > 1 ? "s" : ""})
                    </strong>{" "}
                    • Mode:{" "}
                    <strong className="text-white">
                      {availabilityMeta.confirmationMode === "auto"
                        ? "Instant Confirmation"
                        : "Admin Approval Required"}
                    </strong>
                  </>
                )}
              </p>
            </div>

            {/* Quick Date Picker Grid + Native Date Input */}
            <div>
              <label
                htmlFor="booking-date"
                className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
              >
                1. Select Preferred Date (Monday – Saturday){" "}
                <span className="text-[#E11D2E]">*</span>
              </label>

              {upcomingDates.length > 0 && (
                <div
                  role="group"
                  aria-label="Upcoming dates in Asia/Manila"
                  className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-7"
                >
                  {upcomingDates.map((d) => {
                    const isSelected = draft.appointmentDate === d.dateStr;
                    return (
                      <button
                        key={d.dateStr}
                        type="button"
                        disabled={d.isSunday}
                        onClick={() => {
                          void handleSelectDate(d.dateStr);
                        }}
                        className={`flex flex-col items-center justify-center border p-3 text-center transition-colors ${
                          d.isSunday
                            ? "cursor-not-allowed border-[#292929]/40 bg-[#090909]/40 opacity-40"
                            : isSelected
                            ? "border-[#E11D2E] bg-[#E11D2E] text-white"
                            : "border-[#292929] bg-[#090909] text-white hover:border-white/40"
                        }`}
                      >
                        <span className="font-mono text-[10px] uppercase">
                          {d.dayShort}
                        </span>
                        <span className="mt-0.5 font-display text-2xl font-extrabold">
                          {d.dayNum}
                        </span>
                        <span className="font-mono text-[10px] uppercase">
                          {d.isSunday ? "Closed" : d.monthShort}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="font-mono text-xs text-[#A3A3A3] uppercase">
                  Or choose another date:
                </span>
                <input
                  id="booking-date"
                  type="date"
                  min={upcomingDates[0]?.dateStr}
                  value={draft.appointmentDate}
                  onChange={(e) => {
                    void handleSelectDate(e.target.value);
                  }}
                  aria-invalid={Boolean(errors.appointmentDate)}
                  aria-describedby={
                    errors.appointmentDate ? "err-date" : undefined
                  }
                  className="border border-[#292929] bg-[#090909] px-4 py-2.5 font-mono text-xs text-white focus:border-[#E11D2E]"
                />
                {draft.appointmentDate &&
                  !isSundayInManila(draft.appointmentDate) && (
                    <span className="font-mono text-xs text-white">
                      {formatManilaDate(draft.appointmentDate)}
                    </span>
                  )}
              </div>

              {errors.appointmentDate && (
                <p
                  id="err-date"
                  role="alert"
                  className="mt-3 flex items-center gap-2 text-xs font-medium text-[#FF3045]"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{errors.appointmentDate}</span>
                </p>
              )}
            </div>

            {/* Live Time Slot Selector */}
            <div className="border-t border-[#292929] pt-6">
              <label className="block font-mono text-xs font-semibold tracking-wider text-white uppercase">
                2. Select Available Studio Bay Window{" "}
                <span className="text-[#E11D2E]">*</span>
              </label>

              {!draft.appointmentDate ||
              isSundayInManila(draft.appointmentDate) ? (
                <p className="mt-3 text-sm text-[#A3A3A3]">
                  Select a valid Monday–Saturday date above to compute live
                  bay availability.
                </p>
              ) : isLoadingSlots ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-4 flex items-center gap-3 border border-[#292929] bg-[#090909] p-6 text-sm text-[#A3A3A3]"
                >
                  <Loader2
                    className="h-5 w-5 animate-spin text-[#E11D2E]"
                    aria-hidden="true"
                  />
                  <span>
                    Calculating live bay availability for{" "}
                    {draft.appointmentDate}...
                  </span>
                </div>
              ) : slots.length === 0 ? (
                <div className="mt-4 border border-[#292929] bg-[#090909] p-6 text-sm text-[#A3A3A3]">
                  {availabilityMeta?.blockedReason ??
                    "No appointment windows are available for this date. Please select another Monday–Saturday date."}
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {slots.map((slot) => {
                    const isSelected = draft.timeSlotId === slot.id;
                    const isSelectable = slot.status === "available";
                    const statusBadgeLabel =
                      slot.status === "available"
                        ? isSelected
                          ? "Selected"
                          : "Available"
                        : slot.status === "full"
                        ? "Bay Full"
                        : slot.status === "blocked"
                        ? "Blocked"
                        : "Notice Passed";

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={!isSelectable}
                        aria-pressed={isSelected}
                        onClick={() => updateField("timeSlotId", slot.id)}
                        className={`flex flex-col justify-between border p-5 text-left transition-colors ${
                          !isSelectable
                            ? "cursor-not-allowed border-[#292929]/50 bg-[#090909]/50 opacity-50"
                            : isSelected
                            ? "border-[#E11D2E] bg-[#1C1C1C]"
                            : "border-[#292929] bg-[#090909] hover:border-white/40"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider text-[#E11D2E] uppercase">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              {slot.windowLabel}
                            </span>
                            <span
                              className={`px-2 py-0.5 font-mono text-[10px] uppercase ${
                                !isSelectable
                                  ? "border border-[#292929] text-[#A3A3A3]"
                                  : isSelected
                                  ? "bg-[#E11D2E] text-white"
                                  : "border border-[#292929] text-white"
                              }`}
                            >
                              {statusBadgeLabel}
                            </span>
                          </div>

                          <p className="mt-3 font-display text-xl font-bold tracking-wide text-white uppercase">
                            {slot.label}
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-[#A3A3A3]">
                            {slot.reason}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {errors.timeSlotId && (
                <p
                  role="alert"
                  className="mt-3 flex items-center gap-2 text-xs font-medium text-[#FF3045]"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{errors.timeSlotId}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* ===============================================================
            STEP 5 — CUSTOMER INFORMATION
        =============================================================== */}
        {currentStep === 5 && (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="booking-customer-name"
                  className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
                >
                  Full Name <span className="text-[#E11D2E]">*</span>
                </label>
                <input
                  id="booking-customer-name"
                  type="text"
                  autoComplete="name"
                  value={draft.customerName}
                  onChange={(e) => updateField("customerName", e.target.value)}
                  placeholder="Enter your full name"
                  aria-invalid={Boolean(errors.customerName)}
                  aria-describedby={
                    errors.customerName ? "err-customer-name" : undefined
                  }
                  className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
                />
                {errors.customerName && (
                  <p
                    id="err-customer-name"
                    role="alert"
                    className="mt-2 text-xs text-[#FF3045]"
                  >
                    {errors.customerName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="booking-customer-email"
                  className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
                >
                  Email Address <span className="text-[#E11D2E]">*</span>
                </label>
                <input
                  id="booking-customer-email"
                  type="email"
                  autoComplete="email"
                  value={draft.customerEmail}
                  onChange={(e) => updateField("customerEmail", e.target.value)}
                  placeholder="name@example.com"
                  aria-invalid={Boolean(errors.customerEmail)}
                  aria-describedby={
                    errors.customerEmail ? "err-customer-email" : undefined
                  }
                  className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
                />
                {errors.customerEmail && (
                  <p
                    id="err-customer-email"
                    role="alert"
                    className="mt-2 text-xs text-[#FF3045]"
                  >
                    {errors.customerEmail}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="booking-customer-phone"
                  className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
                >
                  Mobile Number <span className="text-[#E11D2E]">*</span>
                </label>
                <input
                  id="booking-customer-phone"
                  type="tel"
                  autoComplete="tel"
                  value={draft.customerPhone}
                  onChange={(e) => updateField("customerPhone", e.target.value)}
                  placeholder="e.g., 0917 123 4567"
                  aria-invalid={Boolean(errors.customerPhone)}
                  aria-describedby={
                    errors.customerPhone ? "err-customer-phone" : undefined
                  }
                  className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
                />
                {errors.customerPhone && (
                  <p
                    id="err-customer-phone"
                    role="alert"
                    className="mt-2 text-xs text-[#FF3045]"
                  >
                    {errors.customerPhone}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="booking-additional-requests"
                className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
              >
                Additional Requests / Questions{" "}
                <span className="text-[#A3A3A3]">(Optional)</span>
              </label>
              <textarea
                id="booking-additional-requests"
                rows={3}
                value={draft.additionalRequests}
                onChange={(e) =>
                  updateField("additionalRequests", e.target.value)
                }
                placeholder="Let us know if you would like to combine multiple services or have scheduling questions."
                className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
              />
            </div>
          </div>
        )}

        {/* ===============================================================
            STEP 6 — REVIEW SUMMARY & ATOMIC SUBMISSION
        =============================================================== */}
        {currentStep === 6 && (
          <div className="mt-8 space-y-6">
            <p className="text-sm text-[#A3A3A3]">
              Review your appointment details below. Use any{" "}
              <strong className="text-white">Edit</strong> button to update a
              previous step before reserving your studio bay.
            </p>

            {submitError && (
              <div
                role="alert"
                className="border border-[#FF3045] bg-[#FF3045]/10 p-5 text-sm text-white"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#FF3045]"
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <p className="font-mono text-xs font-bold tracking-wider text-[#FF3045] uppercase">
                      Reservation Error ({submitError.code})
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white">
                      {submitError.message}
                    </p>
                    {(submitError.code === "SLOT_CAPACITY_EXHAUSTED" ||
                      submitError.code === "DATE_BLOCKED" ||
                      submitError.code === "MIN_NOTICE_VIOLATION") && (
                      <button
                        type="button"
                        onClick={() => jumpToStepForEdit(4)}
                        className="mt-3 inline-flex items-center gap-1.5 bg-[#E11D2E] px-4 py-2 font-mono text-xs font-bold text-white uppercase hover:bg-[#FF3045]"
                      >
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Select Another Available Window</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Summary Block 1: Vehicle & Service */}
              <div className="border border-[#292929] bg-[#090909] p-5">
                <div className="flex items-center justify-between border-b border-[#292929] pb-3">
                  <h3 className="font-mono text-xs font-semibold tracking-wider text-[#E11D2E] uppercase">
                    01–02 // Vehicle &amp; Service
                  </h3>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => jumpToStepForEdit(1)}
                      className="inline-flex items-center gap-1 font-mono text-xs text-white uppercase hover:text-[#E11D2E]"
                    >
                      <Edit3 className="h-3 w-3" aria-hidden="true" />
                      Edit Type
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToStepForEdit(2)}
                      className="inline-flex items-center gap-1 font-mono text-xs text-white uppercase hover:text-[#E11D2E]"
                    >
                      <Edit3 className="h-3 w-3" aria-hidden="true" />
                      Edit Service
                    </button>
                  </div>
                </div>
                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A3A3A3]">Vehicle Type:</dt>
                    <dd className="font-semibold text-white">
                      {draft.vehicleType}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A3A3A3]">Service Division:</dt>
                    <dd className="font-semibold text-white text-right">
                      {selectedCategory?.title ?? draft.serviceCategorySlug}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A3A3A3]">Selected Treatment:</dt>
                    <dd className="font-semibold text-white text-right">
                      {selectedOption?.name ?? draft.serviceOptionId}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Summary Block 2: Vehicle Specifications */}
              <div className="border border-[#292929] bg-[#090909] p-5">
                <div className="flex items-center justify-between border-b border-[#292929] pb-3">
                  <h3 className="font-mono text-xs font-semibold tracking-wider text-[#E11D2E] uppercase">
                    03 // Vehicle Details
                  </h3>
                  <button
                    type="button"
                    onClick={() => jumpToStepForEdit(3)}
                    className="inline-flex items-center gap-1 font-mono text-xs text-white uppercase hover:text-[#E11D2E]"
                  >
                    <Edit3 className="h-3 w-3" aria-hidden="true" />
                    Edit Vehicle
                  </button>
                </div>
                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A3A3A3]">Manufacturer:</dt>
                    <dd className="font-semibold text-white">
                      {draft.manufacturer}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A3A3A3]">Model &amp; Year:</dt>
                    <dd className="font-semibold text-white">
                      {draft.model} ({draft.year})
                    </dd>
                  </div>
                  {draft.vehicleNotes && (
                    <div className="border-t border-[#292929] pt-2">
                      <dt className="text-xs text-[#A3A3A3]">Vehicle Notes:</dt>
                      <dd className="mt-1 text-xs text-white">
                        {draft.vehicleNotes}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Summary Block 3: Schedule */}
              <div className="border border-[#292929] bg-[#090909] p-5">
                <div className="flex items-center justify-between border-b border-[#292929] pb-3">
                  <h3 className="font-mono text-xs font-semibold tracking-wider text-[#E11D2E] uppercase">
                    04 // Requested Schedule
                  </h3>
                  <button
                    type="button"
                    onClick={() => jumpToStepForEdit(4)}
                    className="inline-flex items-center gap-1 font-mono text-xs text-white uppercase hover:text-[#E11D2E]"
                  >
                    <Edit3 className="h-3 w-3" aria-hidden="true" />
                    Edit Date/Slot
                  </button>
                </div>
                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A3A3A3]">Preferred Date:</dt>
                    <dd className="font-semibold text-white text-right">
                      {formatManilaDate(draft.appointmentDate)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A3A3A3]">Time Window:</dt>
                    <dd className="font-semibold text-white text-right">
                      {selectedSlot?.label ?? draft.timeSlotId}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A3A3A3]">Confirmation Rule:</dt>
                    <dd className="font-mono text-xs text-white uppercase text-right">
                      {availabilityMeta?.confirmationMode === "auto"
                        ? "Instant Confirmation"
                        : "Pending Admin Approval"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A3A3A3]">Studio Location:</dt>
                    <dd className="text-white text-right">
                      {BRAND_CONFIG.location.fullAddress}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Summary Block 4: Customer Info */}
              <div className="border border-[#292929] bg-[#090909] p-5">
                <div className="flex items-center justify-between border-b border-[#292929] pb-3">
                  <h3 className="font-mono text-xs font-semibold tracking-wider text-[#E11D2E] uppercase">
                    05 // Customer Information
                  </h3>
                  <button
                    type="button"
                    onClick={() => jumpToStepForEdit(5)}
                    className="inline-flex items-center gap-1 font-mono text-xs text-white uppercase hover:text-[#E11D2E]"
                  >
                    <Edit3 className="h-3 w-3" aria-hidden="true" />
                    Edit Contact
                  </button>
                </div>
                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A3A3A3]">Full Name:</dt>
                    <dd className="font-semibold text-white">
                      {draft.customerName}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A3A3A3]">Email:</dt>
                    <dd className="font-semibold text-white">
                      {draft.customerEmail}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#A3A3A3]">Mobile:</dt>
                    <dd className="font-semibold text-white">
                      {draft.customerPhone}
                    </dd>
                  </div>
                  {draft.additionalRequests && (
                    <div className="border-t border-[#292929] pt-2">
                      <dt className="text-xs text-[#A3A3A3]">
                        Additional Requests:
                      </dt>
                      <dd className="mt-1 text-xs text-white">
                        {draft.additionalRequests}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Phase 3 Atomic Reservation Submission Box */}
            <div className="border border-[#E11D2E]/60 bg-[#1C1C1C] p-6">
              <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
                <div>
                  <span className="inline-flex items-center gap-2 font-mono text-xs font-bold tracking-wider text-[#E11D2E] uppercase">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {availabilityMeta?.confirmationMode === "auto"
                      ? "Instant Bay Reservation (Auto-Confirmation)"
                      : "Studio Bay Hold Request (Admin Approval Required)"}
                  </span>
                  <p className="mt-2 text-sm leading-relaxed text-[#A3A3A3]">
                    {availabilityMeta?.confirmationMode === "auto"
                      ? "Submitting this form atomically locks your selected studio bay window and issues a confirmed appointment reference."
                      : "Multi-hour and full-panel protection treatments require administrator approval. Submitting this form places a temporary capacity hold on your selected window while awaiting review."}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    void handleSubmitBooking();
                  }}
                  className="inline-flex shrink-0 items-center gap-2.5 bg-[#E11D2E] px-7 py-4 font-display text-base font-bold tracking-[0.14em] text-white uppercase transition-colors hover:bg-[#FF3045] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Reserving Bay...</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {availabilityMeta?.confirmationMode === "auto"
                          ? "Confirm Appointment"
                          : "Submit Booking Request"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step Navigation Controls */}
        <div className="mt-10 flex items-center justify-between border-t border-[#292929] pt-6">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1 || isSubmitting}
            className="inline-flex items-center gap-2 border border-[#292929] bg-[#090909] px-6 py-3.5 font-display text-sm font-bold tracking-[0.14em] text-white uppercase transition-colors hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </button>

          {currentStep < 6 && (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 bg-[#E11D2E] px-7 py-3.5 font-display text-sm font-bold tracking-[0.14em] text-white uppercase transition-colors hover:bg-[#FF3045]"
            >
              <span>
                {returnToReview ? "Save & Return to Review" : "Continue"}
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
