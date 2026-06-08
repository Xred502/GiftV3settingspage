export type GiftcardMakerPageKey = "giftcard";

export interface GiftcardMakerPage {
  key: GiftcardMakerPageKey;
  route: string;
  label: string;
  title: string;
  description: string;
}

export const giftcardMakerPages: GiftcardMakerPage[] = [
  {
    key: "giftcard",
    route: "/GiftcardEditor",
    label: "Giftcard mode",
    title: "Giftcard mode",
    description: "Giftv3 presentkortslayout",
  },
];

export const defaultGiftcardMakerPage = giftcardMakerPages[0];

export function getGiftcardMakerPage(pageKey?: string) {
  return giftcardMakerPages.find((page) => page.key === pageKey) || defaultGiftcardMakerPage;
}

export function getGiftcardMakerPageByRoute(pathname?: string) {
  return giftcardMakerPages.find((page) => page.route === pathname) || defaultGiftcardMakerPage;
}

export function isGiftcardMakerRoute(pathname: string) {
  return giftcardMakerPages.some((page) => page.route === pathname);
}
