"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Lock, Send } from "lucide-react";
import { SERVICE_CATEGORIES, type VehicleType } from "@/lib/constants/site-data";

interface InquiryFormState {
  fullName: string;
  email: string;
  phone: string;
  vehicleType: VehicleType | "";
  serviceSlug: string;
  message: string;
}

export function ContactInquiryForm() {
  const [form, setForm] = useState<InquiryFormState>({
    fullName: "",
    email: "",
    phone: "",
    vehicleType: "",
    serviceSlug: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewValidated, setPreviewValidated] = useState(false);

  const updateField = <K extends keyof InquiryFormState>(
    key: K,
    value: InquiryFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setPreviewValidated(false);
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (form.fullName.trim().length < 2) {
      nextErrors.fullName = "Please enter your full name.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (!form.vehicleType) {
      nextErrors.vehicleType = "Please select a vehicle type.";
    }
    if (form.message.trim().length < 10) {
      nextErrors.message =
        "Please include a brief message about your vehicle and inquiry (at least 10 characters).";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setPreviewValidated(true);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="border border-[#292929] bg-[#1C1C1C] p-6 sm:p-8"
    >
      <div className="border-b border-[#292929] pb-5">
        <p className="font-mono text-xs font-semibold tracking-[0.2em] text-[#E11D2E] uppercase">
          Service &amp; Consultation Inquiry
        </p>
        <h2 className="mt-1 font-display text-3xl font-extrabold tracking-wide text-white uppercase">
          Send an Inquiry
        </h2>
        <p className="mt-2 text-sm text-[#A3A3A3]">
          Have questions about Paint Protection Film coverage, Ceramic or
          Graphene coatings, detailing, window tint, or Moto Pros? Complete the
          form below.
        </p>
      </div>

      <div className="mt-6 space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="contact-full-name"
              className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
            >
              Full Name <span className="text-[#E11D2E]">*</span>
            </label>
            <input
              id="contact-full-name"
              type="text"
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              placeholder="Your full name"
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={
                errors.fullName ? "err-contact-name" : undefined
              }
              className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
            />
            {errors.fullName && (
              <p
                id="err-contact-name"
                role="alert"
                className="mt-1.5 flex items-center gap-1.5 text-xs text-[#FF3045]"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.fullName}</span>
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="contact-email"
              className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
            >
              Email Address <span className="text-[#E11D2E]">*</span>
            </label>
            <input
              id="contact-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="name@example.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "err-contact-email" : undefined}
              className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
            />
            {errors.email && (
              <p
                id="err-contact-email"
                role="alert"
                className="mt-1.5 flex items-center gap-1.5 text-xs text-[#FF3045]"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.email}</span>
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <label
              htmlFor="contact-phone"
              className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
            >
              Mobile Number{" "}
              <span className="text-[#A3A3A3]">(Optional)</span>
            </label>
            <input
              id="contact-phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="0917 123 4567"
              className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
            />
          </div>

          <div>
            <label
              htmlFor="contact-vehicle-type"
              className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
            >
              Vehicle Type <span className="text-[#E11D2E]">*</span>
            </label>
            <select
              id="contact-vehicle-type"
              value={form.vehicleType}
              onChange={(e) =>
                updateField(
                  "vehicleType",
                  e.target.value as InquiryFormState["vehicleType"]
                )
              }
              aria-invalid={Boolean(errors.vehicleType)}
              aria-describedby={
                errors.vehicleType ? "err-contact-vehicle" : undefined
              }
              className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white focus:border-[#E11D2E]"
            >
              <option value="">Select type...</option>
              <option value="Car">Car / SUV / Pickup</option>
              <option value="Motorcycle">Motorcycle (Moto Pros)</option>
            </select>
            {errors.vehicleType && (
              <p
                id="err-contact-vehicle"
                role="alert"
                className="mt-1.5 flex items-center gap-1.5 text-xs text-[#FF3045]"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.vehicleType}</span>
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="contact-service"
              className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
            >
              Service of Interest
            </label>
            <select
              id="contact-service"
              value={form.serviceSlug}
              onChange={(e) => updateField("serviceSlug", e.target.value)}
              className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white focus:border-[#E11D2E]"
            >
              <option value="">General Inquiry / Multiple</option>
              {SERVICE_CATEGORIES.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="contact-message"
            className="block font-mono text-xs font-semibold tracking-wider text-white uppercase"
          >
            Vehicle Details &amp; Inquiry Message{" "}
            <span className="text-[#E11D2E]">*</span>
          </label>
          <textarea
            id="contact-message"
            rows={4}
            value={form.message}
            onChange={(e) => updateField("message", e.target.value)}
            placeholder="Include your vehicle make/model/year and the protection or detailing scope you are considering."
            aria-invalid={Boolean(errors.message)}
            aria-describedby={
              errors.message ? "err-contact-message" : undefined
            }
            className="mt-2 w-full border border-[#292929] bg-[#090909] px-4 py-3 text-sm text-white placeholder-[#A3A3A3]/50 focus:border-[#E11D2E]"
          />
          {errors.message && (
            <p
              id="err-contact-message"
              role="alert"
              className="mt-1.5 flex items-center gap-1.5 text-xs text-[#FF3045]"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errors.message}</span>
            </p>
          )}
        </div>

        {previewValidated && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 border border-[#E11D2E] bg-[#141414] p-4 text-xs text-white"
          >
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-[#E11D2E]"
              aria-hidden="true"
            />
            <div>
              <p className="font-mono font-bold uppercase">
                Form Validation Passed (Phase 2 Frontend Preview)
              </p>
              <p className="mt-1 text-[#A3A3A3]">
                No email has been sent yet because Resend email integration and
                backend persistence are scheduled for Phase 3 &amp; Phase 5.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col items-start justify-between gap-4 border-t border-[#292929] pt-5 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 font-mono text-[11px] text-[#A3A3A3] uppercase">
            <Lock className="h-3.5 w-3.5 text-[#E11D2E]" aria-hidden="true" />
            Frontend preview only — Resend email dispatch activates in Phase 5
          </p>

          <button
            type="submit"
            className="inline-flex items-center gap-2 bg-[#E11D2E] px-6 py-3.5 font-display text-sm font-bold tracking-[0.14em] text-white uppercase transition-colors hover:bg-[#FF3045]"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>Validate Inquiry (Dev Preview)</span>
          </button>
        </div>
      </div>
    </form>
  );
}
