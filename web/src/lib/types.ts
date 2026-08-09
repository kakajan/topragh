export type FaStatus = 'missing' | 'mt_draft' | 'reviewed';

export type Sense = {
  en: string;
  fa: string | null;
};

export type DictEntry = {
  id: string;
  tk: string;
  letter: string;
  en: string;
  fa: string | null;
  fa_status: FaStatus;
  senses: Sense[];
  tags: string[];
};

export type SearchDoc = {
  id: string;
  tk: string;
  tkFold: string;
  en: string;
  fa: string;
  letter: string;
};
