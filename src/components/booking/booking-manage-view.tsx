"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  cancelBookingByTokenAction,
  getLiveServiceAvailabilityAction,
  inspectBookingTokenAction,
  rescheduleBookingByTokenAction,
} from "@/app/actions/booking-actions";
import {
  formatManilaDate,
  getUpcomingManilaDates,
  isSundayInManila,
} from "@/lib/booking/mock-availability";
import type {
  CancelBookingResult,
  RescheduleBookingResult,
  TimeSlotOption,
  TokenInspectionResult,
} from "@/lib/booking/types";

export function BookingManageView() {
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("token") ?? "";
  const urlAction = searchParams.get("action");

  const [tokenInput, setTokenInput] = useState(urlToken);
  const [activeToken, setActiveToken] = useState(urlToken);
  const [inspection, setInspection] = useState<TokenInspectionResult | null>(
    null
  );
  const [isInspecting, setIsInspecting] = useState<boolean>(() =>
    Boolean(urlToken)
  );

  // Cancellation state
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState<CancelBookingResult | null>(
    null
  );

  // Reschedule state
  const upcomingDates = useMemo(() => getUpcomingManilaDates(14), []);
  const [newDate, setNewDate] = useState("");
  const [newTimeSlot, setNewTimeSlot] = useState("");
  const [availableSlots, setAvailableSlots] = useState<TimeSlotOption[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleResult, setRescheduleResult] =
    useState<RescheduleBookingResult | null>(null);

  useEffect(() => {
    if (!activeToken) return;
    let cancelled = false;

    void inspectBookingTokenAction({
      rawToken: activeToken,
      expectedPurpose:
        urlAction === "cancel" || urlAction === "reschedule"
          ? urlAction
          : undefined,
    }).then((res) => {
      if (!cancelled) {
        setInspection(res);
        setIsInspecting(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeToken, urlAction]);

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setCancelResult(null);
    setRescheduleResult(null);
    setIsInspecting(true);
    setActiveToken(tokenInput.trim());
    const res = await inspectBookingTokenAction({
      rawToken: tokenInput.trim(),
    });
    setInspection(res);
    setIsInspecting(false);
  };

  const handleSelectRescheduleDate = async (
    dateStr: string,
    optionSlug: string
  ) => {
    setNewDate(dateStr);
    setNewTimeSlot("");
    if (!dateStr || isSundayInManila(dateStr)) {
      setAvailableSlots([]);
      return;
    }
    setIsLoadingSlots(true);
    const res = await getLiveServiceAvailabilityAction({
      dateStr,
      optionSlug,
    });
    setAvailableSlots(res.slots);
    setIsLoadingSlots(false);
  };

  const handleConfirmCancel = async () => {
    if (isCancelling || !activeToken) return;
    setIsCancelling(true);
    const res = await cancelBookingByTokenAction({
      rawToken: activeToken,
      reason: cancelReason,
    });
    setCancelResult(res);
    setIsCancelling(false);
  };

  const handleConfirmReschedule = async () => {
    if (isRescheduling || !activeToken || !newDate || !newTimeSlot) return;
    setIsRescheduling(true);
    const res = await rescheduleBookingByTokenAction({
      rawToken: activeToken,
      newAppointmentDate: newDate,
      newStartTimeLocal: newTimeSlot,
    });
    setRescheduleResult(res);
    setIsRescheduling(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link
          href="/booking"
          className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-[#A3A3A3] uppercase hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 text-[#E11D2E]" aria-hidden="true" />
          <span>Return to Booking Wizard</span>
        </Link>
        <span className="border border-[#292929] bg-[#141414] px-3 py-1 font-mono text-[11px] text-[#A3A3A3] uppercase">
          Single-Purpose Token Verification
        </span>
      </div>

      {/* Token Input / Lookup Box */}
      <form
        onSubmit={(e) => {
          void handleManualVerify(e);
        }}
        className="mb-8 border border-[#292929] bg-[#141414] p-6"
      >
        <label
          htmlFor="manage-token-input"
          className="flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-white uppercase"
        >
          <KeyRound className="h-4 w-4 text-[#E11D2E]" aria-hidden="true" />
          <span>Customer Appointment Security Token</span>
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="manage-token-input"
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste your single-use cancel or reschedule token..."
            className="flex-1 border border-[#292929] bg-[#090909] px-4 py-3 font-mono text-xs text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
          />
          <button
            type="submit"
            disabled={isInspecting || !tokenInput.trim()}
            className="inline-flex items-center justify-center gap-2 bg-[#E11D2E] px-6 py-3 font-display text-sm font-bold tracking-[0.14em] text-white uppercase transition-colors hover:bg-[#FF3045] disabled:opacity-50"
          >
            {isInspecting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            )}
            <span>Verify Token</span>
          </button>
        </div>
      </form>

      {/* Loading State */}
      {isInspecting && (
        <div className="flex items-center gap-3 border border-[#292929] bg-[#141414] p-8 text-sm text-[#A3A3A3]">
          <Loader2
            className="h-5 w-5 animate-spin text-[#E11D2E]"
            aria-hidden="true"
          />
          <span>Verifying SHA-256 token digest against booking records...</span>
        </div>
      )}

      {/* Invalid / Expired / Used Token Error */}
      {!isInspecting && inspection && !inspection.ok && (
        <div
          role="alert"
          className="border border-[#FF3045] bg-[#141414] p-8 text-white"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-6 w-6 shrink-0 text-[#FF3045]"
              aria-hidden="true"
            />
            <div>
              <p className="font-mono text-xs font-bold tracking-wider text-[#FF3045] uppercase">
                Token Verification Failed ({inspection.errorCode})
              </p>
              <h2 className="mt-1 font-display text-2xl font-extrabold tracking-wide text-white uppercase">
                Unable to Authorize Request
              </h2>
              <p className="mt-2 text-sm text-[#A3A3A3]">{inspection.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Valid Token Details & Action Panel */}
      {!isInspecting && inspection && inspection.ok && (
        <div className="border border-[#292929] bg-[#141414] p-6 sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#292929] pb-6">
            <div>
              <span className="inline-flex items-center gap-1.5 border border-[#E11D2E]/50 bg-[#1C1C1C] px-3 py-1 font-mono text-xs font-bold text-[#E11D2E] uppercase">
                Authorized Token Scope:{" "}
                {inspection.purpose === "cancel"
                  ? "Cancellation Only"
                  : "Reschedule Only"}
              </span>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-wide text-white uppercase sm:text-4xl">
                {inspection.booking.serviceName}
              </h2>
              <p className="mt-1 text-sm text-[#A3A3A3]">
                {inspection.booking.vehicleSummary} • Current Status:{" "}
                <strong className="font-mono text-white uppercase">
                  {inspection.booking.status}
                </strong>
              </p>
            </div>

            <div className="border border-[#292929] bg-[#090909] p-4 text-right">
              <p className="font-mono text-[10px] tracking-widest text-[#A3A3A3] uppercase">
                Booking Reference
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-[#E11D2E]">
                {inspection.booking.referenceCode}
              </p>
            </div>
          </div>

          <div className="mt-6 border border-[#292929] bg-[#090909] p-5 text-sm">
            <p className="font-mono text-xs font-semibold text-[#E11D2E] uppercase">
              Current Scheduled Window (Asia/Manila)
            </p>
            <p className="mt-2 font-semibold text-white">
              {formatManilaDate(inspection.booking.appointmentDate)} •{" "}
              {inspection.booking.startTimeLocal} –{" "}
              {inspection.booking.endTimeLocal} (
              {inspection.booking.durationMinutes} mins)
            </p>
          </div>

          {/* ===============================================================
              CANCEL FLOW
          =============================================================== */}
          {inspection.purpose === "cancel" && (
            <div className="mt-8 border-t border-[#292929] pt-6">
              {cancelResult?.ok ? (
                <div className="border border-emerald-500/40 bg-emerald-500/10 p-6 text-white">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-mono text-xs font-bold tracking-wider text-emerald-400 uppercase">
                        Cancellation Confirmed
                      </p>
                      <h3 className="mt-1 font-display text-2xl font-bold uppercase">
                        Appointment {cancelResult.referenceCode} Cancelled
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-[#A3A3A3]">
                        Your allocated studio bay capacity has been released and
                        all single-use tokens for this appointment have been
                        invalidated.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold tracking-wide text-white uppercase">
                    Cancel This Appointment
                  </h3>
                  <p className="text-xs leading-relaxed text-[#A3A3A3]">
                    Cancelling will immediately release your studio bay hold and
                    consume this single-use cancellation token.
                  </p>

                  <div>
                    <label
                      htmlFor="cancel-reason"
                      className="block font-mono text-xs font-semibold text-white uppercase"
                    >
                      Reason for Cancellation{" "}
                      <span className="text-[#A3A3A3]">(Optional)</span>
                    </label>
                    <input
                      id="cancel-reason"
                      type="text"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="e.g., Schedule conflict, travel change..."
                      className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
                    />
                  </div>

                  {cancelResult && !cancelResult.ok && (
                    <p
                      role="alert"
                      className="text-xs font-medium text-[#FF3045]"
                    >
                      {cancelResult.message}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => {
                      void handleConfirmCancel();
                    }}
                    className="inline-flex items-center gap-2 bg-[#E11D2E] px-6 py-3.5 font-display text-sm font-bold tracking-[0.14em] text-white uppercase transition-colors hover:bg-[#FF3045] disabled:opacity-50"
                  >
                    {isCancelling ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>Confirm Cancellation</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===============================================================
              RESCHEDULE FLOW
          =============================================================== */}
          {inspection.purpose === "reschedule" && (
            <div className="mt-8 border-t border-[#292929] pt-6">
              {rescheduleResult?.ok ? (
                <div className="border border-emerald-500/40 bg-emerald-500/10 p-6 text-white">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400"
                      aria-hidden="true"
                    />
                    <div className="w-full">
                      <p className="font-mono text-xs font-bold tracking-wider text-emerald-400 uppercase">
                        Reschedule Confirmed — Previous Token Consumed
                      </p>
                      <h3 className="mt-1 font-display text-2xl font-bold uppercase">
                        Updated Schedule:{" "}
                        {formatManilaDate(rescheduleResult.appointmentDate)} (
                        {rescheduleResult.startTimeLocal} –{" "}
                        {rescheduleResult.endTimeLocal} PHT)
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-[#A3A3A3]">
                        Your previous slot has been released and your new bay
                        allocation is locked. Fresh single-use tokens have been
                        issued for your updated appointment:
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setRescheduleResult(null);
                            setTokenInput(
                              rescheduleResult.newTokens.rescheduleToken
                            );
                            setActiveToken(
                              rescheduleResult.newTokens.rescheduleToken
                            );
                          }}
                          className="border border-[#292929] bg-[#090909] px-4 py-2 font-mono text-xs text-white uppercase hover:border-[#E11D2E]"
                        >
                          Load New Reschedule Token
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRescheduleResult(null);
                            setTokenInput(
                              rescheduleResult.newTokens.cancelToken
                            );
                            setActiveToken(
                              rescheduleResult.newTokens.cancelToken
                            );
                          }}
                          className="border border-[#292929] bg-[#090909] px-4 py-2 font-mono text-xs text-white uppercase hover:border-[#E11D2E]"
                        >
                          Load New Cancel Token
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-display text-2xl font-bold tracking-wide text-white uppercase">
                      Select New Date &amp; Available Bay Window
                    </h3>
                    <p className="mt-1 text-xs text-[#A3A3A3]">
                      Choose a Monday–Saturday date below to check live capacity
                      for <strong>{inspection.booking.serviceName}</strong>.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-7">
                    {upcomingDates.map((d) => {
                      const isSelected = newDate === d.dateStr;
                      return (
                        <button
                          key={d.dateStr}
                          type="button"
                          disabled={d.isSunday}
                          onClick={() => {
                            void handleSelectRescheduleDate(
                              d.dateStr,
                              inspection.booking.serviceOptionSlug
                            );
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
                          <span className="mt-0.5 font-display text-xl font-extrabold">
                            {d.dayNum}
                          </span>
                          <span className="font-mono text-[10px] uppercase">
                            {d.isSunday ? "Closed" : d.monthShort}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {isLoadingSlots && (
                    <div className="flex items-center gap-3 border border-[#292929] bg-[#090909] p-5 text-xs text-[#A3A3A3]">
                      <Loader2
                        className="h-4 w-4 animate-spin text-[#E11D2E]"
                        aria-hidden="true"
                      />
                      <span>Checking bay availability for {newDate}...</span>
                    </div>
                  )}

                  {!isLoadingSlots && newDate && availableSlots.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {availableSlots.map((slot) => {
                        const isSelectable = slot.status === "available";
                        const isSelected = newTimeSlot === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            disabled={!isSelectable}
                            onClick={() => setNewTimeSlot(slot.id)}
                            className={`border p-4 text-left transition-colors ${
                              !isSelectable
                                ? "cursor-not-allowed border-[#292929]/40 bg-[#090909]/40 opacity-45"
                                : isSelected
                                ? "border-[#E11D2E] bg-[#1C1C1C]"
                                : "border-[#292929] bg-[#090909] hover:border-white/40"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#E11D2E] uppercase">
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                {slot.windowLabel}
                              </span>
                              <span className="font-mono text-[10px] text-white uppercase">
                                {isSelectable ? "Available" : slot.status}
                              </span>
                            </div>
                            <p className="mt-2 font-display text-lg font-bold text-white uppercase">
                              {slot.label}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {rescheduleResult && !rescheduleResult.ok && (
                    <p
                      role="alert"
                      className="text-xs font-medium text-[#FF3045]"
                    >
                      {rescheduleResult.message}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={isRescheduling || !newDate || !newTimeSlot}
                    onClick={() => {
                      void handleConfirmReschedule();
                    }}
                    className="inline-flex items-center gap-2 bg-[#E11D2E] px-6 py-3.5 font-display text-sm font-bold tracking-[0.14em] text-white uppercase transition-colors hover:bg-[#FF3045] disabled:opacity-50"
                  >
                    {isRescheduling ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>Confirm New Appointment Window</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
