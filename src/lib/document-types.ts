export type PartyDetails = {
  fullName?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
};

export type FflDetails = {
  dealerName?: string;
  dealerAddress?: string;
  dealerCity?: string;
  dealerState?: string;
  dealerZip?: string;
  dealerLicenseNumber?: string;
  transferDate?: string;
  notes?: string;
};

export type FirearmPayload = {
  templateKey?: string;
  templateVersion?: number;
  transaction?: {
    agreementDate?: string;
    price?: number;
    sellerState?: string;
    buyerState?: string;
    interstate?: boolean;
    externalFflRequired?: boolean;
    ffl?: FflDetails;
  };
  firearm?: {
    manufacturer?: string;
    model?: string;
    caliber?: string;
    firearmType?: string;
    serialNumber?: string;
    notes?: string;
  };
  parties?: {
    BUYER?: PartyDetails;
    SELLER?: PartyDetails;
  };
};

export function partyDetailsComplete(details?: PartyDetails) {
  return Boolean(
    details?.fullName?.trim() &&
      details?.street?.trim() &&
      details?.city?.trim() &&
      details?.state?.trim() &&
      details?.zip?.trim() &&
      details?.email?.trim(),
  );
}


export function firearmDetailsComplete(details?: FirearmPayload["firearm"]) {
  return Boolean(
    details?.manufacturer?.trim() &&
      details?.model?.trim() &&
      details?.caliber?.trim() &&
      details?.firearmType?.trim() &&
      details?.serialNumber?.trim(),
  );
}
