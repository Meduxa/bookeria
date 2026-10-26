// How many SMS segments a text costs. Latin text in the GSM-7 alphabet fits
// 160 characters (153 per part when split); anything else — Georgian, Russian,
// emoji — is sent as Unicode: 70 characters (67 per part).

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€\f"; // cost two characters each

export type SegmentInfo = {
  encoding: "gsm" | "unicode";
  length: number;
  segments: number;
  perSegment: number;
};

export function countSegments(text: string): SegmentInfo {
  let gsm = true;
  let gsmLength = 0;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) gsmLength += 1;
    else if (GSM_EXTENDED.includes(ch)) gsmLength += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) {
    const segments = gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153);
    return {
      encoding: "gsm",
      length: gsmLength,
      segments: Math.max(1, segments),
      perSegment: segments > 1 ? 153 : 160,
    };
  }
  const length = text.length; // UTF-16 code units: an emoji counts as 2
  const segments = length <= 70 ? 1 : Math.ceil(length / 67);
  return { encoding: "unicode", length, segments: Math.max(1, segments), perSegment: segments > 1 ? 67 : 70 };
}
