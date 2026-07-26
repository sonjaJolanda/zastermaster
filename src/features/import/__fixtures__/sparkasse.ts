/** Synthetic MT940-like Sparkasse snippet — no real account data. */
export const sparkasseSampleMt940 = [
  ":20:STARTUMS",
  ":25:50050000/1234567890",
  ":28C:1/1",
  ":60F:C260720EUR1000,00",
  ":61:2607200720D12,34NMSCNONREF",
  ":86:204?00SEPA-Lastschrift?20REWE EINKAUF?30COBADEFFXXX?31DE00120300009999999999?32REWE",
  ":62F:C260720EUR987,66",
  "-",
].join("\n");
