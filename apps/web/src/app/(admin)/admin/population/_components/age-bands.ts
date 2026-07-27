// WHO/EPI age bands. `surviving_infants` is the denominator of routine infant coverage —
// live births minus infant deaths — and is the one most reports actually divide by.
export const AGE_BANDS: { value: string; label: string; hint: string }[] = [
  { value: "surviving_infants", label: "জীবিত শিশু (০-১১ মাস)", hint: "রুটিন কভারেজের হর" },
  { value: "live_births", label: "জীবিত জন্ম", hint: "বিসিজি ও জন্মকালীন ডোজের হর" },
  { value: "0_11m", label: "০-১১ মাস", hint: "" },
  { value: "12_23m", label: "১২-২৩ মাস", hint: "এমআর-২ ও বুস্টারের হর" },
  { value: "0_59m", label: "০-৫৯ মাস", hint: "ক্যাম্পেইনের হর" },
];
