import { CATEGORIES } from "./categories";
import type { DenialCategory, Locale } from "./types";

/**
 * Korean versions of the reader-facing category text. The argument
 * paragraphs are not translated: they go into the appeal letter, which is
 * always written in English for the plan.
 */
export interface CategoryText {
  label: string;
  meaning: string;
  whatHelps: string;
  evidence: string[];
}

const KO: Record<DenialCategory, CategoryText> = {
  medical_necessity: {
    label: "의학적으로 필요하지 않다는 이유",
    meaning:
      "플랜은 이 치료가 보장 대상이라는 점은 인정하지만, 검토한 기록만으로는 환자에게 꼭 필요하다는 점이 확인되지 않는다고 판단했습니다. 이 치료를 절대 보장하지 않는다는 규정이 아니라, 환자의 상태에 대한 판단입니다.",
    whatHelps:
      "담당 의사가 이 환자에게 왜 이 치료가 필요한지 구체적으로 설명한 소견서와 이를 뒷받침하는 진료 기록이 도움이 됩니다. 이런 거부는 부족한 자료만 보고 내려지는 경우가 많습니다.",
    evidence: [
      "담당 의사의 의학적 필요성 소견서(letter of medical necessity)",
      "최근 진료 기록, 검사 결과, 영상 판독 결과",
      "이미 받아 본 치료와 그 경과를 정리한 목록",
      "거부 통지서에 언급된 플랜의 보장 기준(있는 경우)",
    ],
  },
  level_of_care: {
    label: "더 낮은 단계의 치료만 승인",
    meaning:
      "플랜은 치료가 전혀 필요 없다고 한 것이 아닙니다. 요청한 치료 환경(예: 입원 재활병원, 전문요양시설 입원)은 필요 이상이고, 가정 방문 간호나 외래 치료처럼 강도가 낮은 방식으로 충분하다고 본 것입니다.",
    whatHelps:
      "더 낮은 단계의 치료가 왜 안전하지 않거나 현실적으로 어려운지 구체적으로 보여 주세요. 일상생활에 어떤 도움이 필요한지, 치료사와 의사가 무엇을 권했는지, 집에서는 어떤 문제가 생길 수 있는지가 중요합니다.",
    evidence: [
      "이 치료 환경이 필요하다는 담당 의사 또는 병원 의료진의 권고",
      "물리치료·작업치료 평가서",
      "걷기, 자리 옮기기, 목욕, 약 복용에 도움이 얼마나 필요한지에 대한 기록",
      "집 상황에 대한 간단한 설명(계단, 도와줄 사람, 혼자 있는 시간)",
    ],
  },
  out_of_network: {
    label: "네트워크 외 의료 제공자",
    meaning:
      "해당 의사나 시설이 플랜의 네트워크에 속해 있지 않고, 네트워크 안의 다른 제공자가 같은 치료를 할 수 있다고 보아 거부한 것입니다.",
    whatHelps:
      "네트워크 안에서는 이 치료를 합리적으로 받을 수 없다는 점을 보여 주세요. 가까운 곳에 없거나, 필요한 전문성이 없거나, 예약이 너무 늦는 경우입니다. 네트워크로 환자의 필요를 채울 수 없을 때 플랜은 네트워크 밖 치료를 주선해야 합니다.",
    evidence: [
      "문의해 본 네트워크 내 제공자의 이름, 날짜, 들은 답변",
      "네트워크 내 선택지의 대기 기간이나 거리",
      "이 제공자가 꼭 필요한 이유를 적은 의사의 소견",
    ],
  },
  not_covered: {
    label: "보장 대상이 아니라는 이유",
    meaning: "환자의 상태와 관계없이 이 항목이나 서비스 자체가 플랜의 보장 범위에 들어 있지 않다는 뜻입니다.",
    whatHelps:
      "오리지널 메디케어가 이 항목을 보장하는지 확인해 보세요. 메디케어 어드밴티지 플랜은 오리지널 메디케어가 보장하는 것을 모두 보장해야 하므로, 메디케어가 보장한다면 플랜도 대체로 보장해야 합니다. 플랜의 보장 범위 설명서(Evidence of Coverage)에 보장 항목이 나와 있습니다.",
    evidence: [
      "보장 범위 설명서(Evidence of Coverage)에서 이 혜택을 설명한 페이지",
      "의사 사무실에서 알려 줄 수 있는 관련 메디케어 보장 규정",
      "무엇을 왜 처방했는지 정확히 설명한 의사의 소견서",
    ],
  },
  missing_info: {
    label: "자료 부족",
    meaning:
      "승인에 필요한 기록을 받지 못했다는 뜻입니다. 치료가 필요 없다고 결정한 것이 아니라, 판단할 수 없었다는 것입니다.",
    whatHelps:
      "빠진 기록을 플랜에 보내면 됩니다. 가장 빨리 해결되는 유형인 경우가 많습니다. 의사 사무실에 전화해 통지서에 무엇이 빠졌다고 적혀 있는지 알리고, 직접 보내 달라고 하거나 사본을 받아 함께 보내세요.",
    evidence: [
      "통지서에서 빠졌다고 한 바로 그 기록",
      "최근 진료 기록과 검사 결과",
      "기록이 이 요청과 어떻게 관련되는지 적은 의사 사무실의 간단한 안내문",
    ],
  },
  step_therapy: {
    label: "다른 치료를 먼저 받으라는 요구",
    meaning: "이 치료를 승인하기 전에, 보통 더 저렴한 다른 치료나 약을 먼저 써 보라는 뜻입니다.",
    whatHelps:
      "그 치료를 이미 해 봤지만 효과가 없었거나, 부작용이 있었거나, 환자에게 안전하지 않다는 점을 보여 주세요. 이런 이력은 대개 의사 사무실 차트에 있습니다.",
    evidence: [
      "이미 받아 본 치료의 날짜와 결과",
      "부작용이 있었거나, 요구된 대체 치료가 환자에게 안전하지 않은 이유",
      "지금 이 치료가 필요한 이유에 대한 의사의 소견",
    ],
  },
  experimental: {
    label: "실험적·연구 단계 치료라는 이유",
    meaning: "이 치료가 환자의 질환에 대해 보장할 만큼 충분히 검증되지 않았다는 뜻입니다.",
    whatHelps:
      "이 치료가 널리 인정된 치료라는 근거가 필요합니다. 이를 보장하는 메디케어 규정, 이 용도에 대한 FDA 승인, 전문 학회의 진료 지침 등입니다. 대개 의사의 도움이 필요합니다.",
    evidence: [
      "이 치료를 뒷받침하는 지침이나 연구를 인용한 의사의 소견서",
      "약이나 기기라면 이 용도에 대한 FDA 승인 정보",
      "적용되는 메디케어 보장 규정",
    ],
  },
  other: {
    label: "그 밖의 이유",
    meaning:
      "이 통지서의 이유는 흔한 유형에 딱 들어맞지 않습니다. 플랜의 설명을 자세히 읽어 보세요. 통지서에는 구체적인 이유와 근거로 삼은 규정이 반드시 적혀 있어야 합니다.",
    whatHelps:
      "플랜이 밝힌 이유에 정면으로 답하고 담당 의사의 기록을 함께 보내세요. 이유가 분명하지 않으면 통지서에 적힌 번호로 전화해 설명을 요청하고, 통화한 사람과 날짜를 적어 두세요.",
    evidence: [
      "플랜이 밝힌 이유에 답하는 담당 의사의 소견서",
      "관련 진료 기록",
      "플랜과 통화한 내용의 메모(날짜, 이름, 들은 내용)",
    ],
  },
};

export function categoryText(category: DenialCategory, locale: Locale): CategoryText {
  if (locale === "ko") return KO[category];
  const { label, meaning, whatHelps, evidence } = CATEGORIES[category];
  return { label, meaning, whatHelps, evidence };
}
