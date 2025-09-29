import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type Lead = {
  id: string;
  company: string;
  email: string;
  industryType?: string;
  productCategory?: string;
  country?: string;
  description?: string;
  website?: string;
};

export const leadsAtom = atomWithStorage<Lead[]>("leads", []);
export const selectedLeadIdsAtom = atom<string[]>([]);
