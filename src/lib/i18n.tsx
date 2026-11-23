import type { ReactNode } from "react";
import { RULES } from "./rules";
import type { Locale } from "./types";

/**
 * Every piece of interface text, in English and Korean.
 *
 * The denial notice and the appeal letter are never translated: the plan
 * writes and reads English. Everything that explains, instructs or warns is.
 *
 * `ko` is typed as `typeof en`, so a missing or extra Korean string is a
 * compile error.
 */

const D = RULES.daysToFileReconsideration;
const FAST = RULES.planDecision.expeditedHours;

const en = {
  toggleLabel: "Language",
  hero: {
    title: "Denied by a Medicare Advantage plan? You can appeal.",
    sub: "Most people never do. Turn the denial letter into a plain-language explanation, a first-draft appeal and a deadline, in a few minutes.",
  },
  steps: ["Your letter", "What it means", "Your side", "Appeal draft", "Send and track"],
  stepOf: (n: number, total: number, label: string) => `Step ${n} of ${total}: ${label}`,
  progress: "Progress",
  back: "Back",
  eraseSmall: "Erase this appeal from this device",
  eraseConfirm: "Erase this appeal from this device and start over?",
  busy: {
    reading: "Reading the letter…",
    photo: "Preparing the photo…",
    drafting: "Writing your draft…",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    bad_json: "Something went wrong. Please try again.",
    missing: "Some details are missing. Go back a step and try again.",
    photo_type: "The photo must be a JPEG, PNG or WebP image.",
    photo_large: "That photo is too large. Try a smaller one.",
    photo_off: "Reading photos is not switched on for this site yet. Please type or paste the letter's text instead.",
    photo_unreadable: "We could not read that photo. Try a sharper, well-lit photo, or paste the text instead.",
    photo_device: "We could not use that photo on this device.",
    text_short: "Paste the full text of the denial letter so we have enough to work with.",
    text_long: "That is longer than a denial letter usually is. Paste just the denial notice.",
    pdf: "We could not make the PDF. Copy the text instead.",
    copy: "Copying is blocked in this browser. Select the text and copy it by hand.",
  } as Record<string, string>,
  capture: {
    title: "Start with the denial letter",
    intro:
      "Type or paste the letter from the Medicare Advantage plan, or take a photo of it. We will explain what it says and help you draft an appeal.",
    pasteLabel: "Paste the letter's text",
    pasteHint: "Include the whole notice if you can, especially the date and the reason.",
    explain: "Explain this letter",
    usePhoto: "Use a photo instead",
    photoAria: "Photo of the denial letter",
    multiPage: "For a multi-page letter, photograph the page that gives the reason and the date, or paste the text.",
    sample: (button: ReactNode) => <>No letter handy? {button} to see how it works.</>,
    sampleButton: "Load a made-up sample letter",
    privacyTitle: "Your privacy",
    privacyBody:
      "We do not create an account or keep your letter on our servers. Your progress is saved only in this browser on this device, and you can erase it at any time. To read and draft, the letter's text is sent to an AI service for processing.",
  },
  understand: {
    title: "What this letter means",
    oosTitle: "This may not be the kind of denial we cover yet",
    oosBody: (
      <>
        Overturned currently handles one situation: a Medicare Advantage plan refusing to approve care <em>before</em> you get
        it. The deadlines below may not apply to your letter. You can keep going, but check everything against your notice or
        call 1-800-MEDICARE.
      </>
    ),
    planWords: "The plan's words:",
    translating: "Translating this explanation…",
    notTranslated: "This explanation could not be translated just now, so it is shown as it was first written.",
    helpsTitle: "What usually helps with this kind of denial",
    checkTitle: "Please double check",
    keywordReader:
      "This letter was read by a basic keyword reader, not the full AI reader, so details below may be missing or wrong. Check each one against your letter.",
    warn: {
      not_ma:
        "This does not clearly read as a Medicare Advantage denial notice. The deadlines here only apply to Medicare Advantage (Part C) plans.",
      payment:
        "This may be a denial of payment for care already received. Payment appeals follow a different timeline (the plan has 60 days to decide).",
      part_d: "This may be a Part D prescription drug denial, which has its own appeal process.",
      no_date: "We could not find the date on the notice. Enter it yourself; the deadline is counted from that date.",
    } as Record<string, string>,
    detailsTitle: "Check these details against your letter",
    detailsIntro: "We pulled these from the letter. Fix anything that is wrong or blank.",
    noticeDate: "Date on the notice",
    noticeDateHint: "The date printed on the letter itself. Your deadline is counted from it.",
    planName: "Plan name",
    whatDenied: "What was denied",
    memberId: "Member ID",
    refNumber: "Reference number",
    whereSend: "Where to send the appeal",
    whereSendHint: "The appeals mailing address printed on the notice.",
    fax: "Appeals fax number, if listed",
    kind: "Kind of denial",
    kindHint: "Change this if we got it wrong. It shapes the draft.",
    requested: "What was requested",
    reqService: "A medical service, stay, test or equipment",
    reqDrug: "A drug given in a doctor's office or clinic (Part B drug)",
    next: "Continue to my side of the story",
  },
  deadline: {
    title: "Your deadline",
    enterDate: `Enter the date printed on the notice to see your deadline. You generally have ${D} days from that date.`,
    overdue: (date: string): ReactNode => (
      <>
        The {D}-day window appears to have ended on <strong>{date}</strong>. You can still ask the plan to accept a late appeal
        if there was a good reason for the delay. Send it as soon as you can.
      </>
    ),
    mustReceive: (date: string): ReactNode => (
      <>
        The plan must <em>receive</em> the appeal by <strong>{date}</strong>.
      </>
    ),
    daysLeft: (n: number) => (n === 0 ? "That is today" : `${n} ${n === 1 ? "day" : "days"} left`),
    dontWait: (weekend: boolean) =>
      `Do not wait for the last day. Mail can take a week${weekend ? ", and this date falls on a weekend" : ""}. Aim to send it at least 10 days early.`,
    confirm: (
      <>
        <strong>Confirm this date on your own notice.</strong> We count {D} calendar days from the date on the notice, which is
        the general Medicare rule. Your notice is the final word.
      </>
    ),
  },
  facts: {
    title: "Your side of the story",
    intro: (
      <>
        Plain words are fine. Write it in the voice of the person who will sign: &ldquo;I&rdquo; if the patient signs, &ldquo;my
        mother&rdquo; or &ldquo;my father&rdquo; if you sign for them. Write what you know to be true. You can skip anything
        you are unsure of; we will ask about whatever the letter still needs on the next step.
      </>
    ),
    /** Shown only in Korean mode. */
    languageNote: "",
    nameInEnglish: "Write this name in English letters, exactly as on the plan card. Names are not translated.",
    addressInEnglish: "Addresses are not translated. Write it the way the post office would deliver it.",
    whoSigns: "Who will sign the letter?",
    signPatient: (
      <>
        <strong>The patient.</strong> Simplest. If you are helping a parent, write it together and have them sign.
      </>
    ),
    signRep: (link: (text: string) => ReactNode): ReactNode => (
      <>
        <strong>Me, on the patient&apos;s behalf.</strong> The plan will need a signed {link("Appointment of Representative form")}{" "}
        or legal papers such as a health care power of attorney.
      </>
    ),
    patientName: "Patient's full name",
    patientNameHint: "As it appears on the plan card.",
    yourName: "Your full name",
    address: "Mailing address for the reply",
    phone: "Phone number",
    why: "Why is this care needed?",
    whyHint: "What happened, what the doctor recommended, and why.",
    tried: "What has already been tried?",
    triedHint: "Other treatments, therapy, medicines, and how they went. Skip if none.",
    harm: "What happens if this care is delayed or refused?",
    harmHint: "Safety at home, pain, falls, losing ground, and so on.",
    doctor: "Treating doctor's name",
    doctorSupports: "The doctor will write a letter supporting this appeal.",
    doctorSupportsHint: "Worth asking for. It is often the strongest thing you can include.",
    fast: `Ask for a fast appeal (${FAST} hours).`,
    fastHint: (window: string) =>
      `For when waiting ${window} could seriously harm the patient's health or ability to recover. If the doctor asks for a fast appeal, the plan has to grant it, so the quickest route is often to have the doctor's office call the plan.`,
    late: "Why couldn't the appeal be sent in time?",
    lateHint: `The ${D}-day window appears to have passed. Plans can accept a late appeal for a good reason, such as serious illness or never receiving the notice.`,
    submit: "Write my draft",
  },
  letter: {
    title: "Your appeal draft",
    intro:
      "This is a first draft. Read every line and make sure it is accurate. You are the one signing it. You can also edit the letter directly.",
    /** Shown only in Korean mode. */
    englishNote: "",
    translated:
      "Your answers in Korean were translated into English by AI for this letter. Check that the English says what you meant.",
    translationFailed:
      "We could not translate some of your Korean answers just now, so they are not in the letter yet. They are listed below: press Update the letter to try again.",
    translationUnavailable:
      "Translation is not working on this site right now, so your Korean answers are not in the letter yet. They are listed below: try Update the letter again later, or answer in English.",
    hangulLeft:
      "This letter still has Korean characters in it. They will not print correctly in the PDF, and the plan needs the letter in English. Replace them before sending.",
    needed: (n: number) => `${n} more ${n === 1 ? "detail" : "details"} needed`,
    neededIntro: "Answer here and we will put each answer into the letter for you. You do not need to edit the letter yourself.",
    neededSkip: "Skip anything you do not know yet. You can come back to it.",
    update: "Update the letter",
    genericQuestion: (what: string) => `Please tell us: ${what}`,
    editedConfirm: "You have edited the letter by hand. Updating will rewrite it and those edits will be lost. Continue?",
    textareaLabel: "Appeal letter text",
    tailored: "The argument paragraphs were drafted by AI from what you wrote. It can make mistakes. Check that every fact is true.",
    standard: "This draft uses our standard wording for this kind of denial.",
    rules:
      "The rules it cites are federal Medicare regulations; your doctor's office or a free Medicare counselor can help you check they fit your case.",
    pdf: "Download PDF to print",
    copy: "Copy text",
    copied: "Copied",
    next: "Next: send and track",
    backToAnswers: "Back to change my answers",
  },
  next: {
    title: "Send it and keep track",
    calendar: "Add the deadline to my calendar",
    ics: {
      summary: (plan: string) => `Appeal deadline: ${plan || "Medicare Advantage plan"} must RECEIVE the appeal`,
      description: (service: string, date: string) =>
        `Last day for the plan to receive the appeal of the denial of ${service || "the requested care"}: ${date}. Send it well before this date and keep proof of delivery. Confirm the deadline against the denial notice.`,
      alarm: (days: number) => `Appeal deadline in ${days} days`,
    },
    beforeTitle: "Before you send",
    checklistStart: [
      "Answer any questions still open on the draft step, then print the letter and sign it.",
      "Attach a copy of the denial notice.",
    ],
    gather: (item: string) => `Gather if you can: ${item.charAt(0).toLowerCase()}${item.slice(1)}.`,
    checklistRep: "Attach the signed Appointment of Representative form or power of attorney.",
    checklistEnd: [
      "Keep a copy of everything you send.",
      "Send it in a way that gives you proof: certified mail with return receipt, or fax with a confirmation page.",
      "Call the plan a few days later to confirm they received it. Write down the date and who you spoke with.",
    ],
    whenTitle: "When will the plan answer?",
    whenBody: (window: string, fast: boolean): ReactNode => (
      <>
        Once the plan receives your appeal, it has <strong>{window}</strong> to decide
        {fast ? ", if it agrees the appeal should be fast" : ""}.
      </>
    ),
    received: "Date the plan received your appeal",
    receivedHint: "Fill this in once you have delivery confirmation.",
    expectBy: (date: string): ReactNode => (
      <>
        Expect a written decision by <strong>{date}</strong>. If you hear nothing by then, call the plan and 1-800-MEDICARE.
      </>
    ),
    againTitle: "If the plan says no again",
    againIntro: "This appeal is the first of five possible levels. Most people never need the later ones.",
    helpTitle: "Free help from real people",
    ship: "State Health Insurance Assistance Program (SHIP)",
    shipNote: ": free, unbiased Medicare counselors in every state.",
    phone: (
      <>
        <strong>1-800-MEDICARE</strong> (1-800-633-4227), any time.
      </>
    ),
    /** Shown only in Korean mode. */
    interpreter: null as ReactNode,
    medicareLink: "Medicare.gov: appeals in Medicare health plans",
    backToLetter: "Back to my letter",
    startOver: "Erase and start over",
  },
  footer: {
    disclaimer: (
      <>
        <strong className="text-ink">Overturned is not legal or medical advice.</strong> It is an information and drafting aid.
        It is not affiliated with Medicare, the U.S. government or any health plan. Always confirm deadlines and instructions on
        your own denial notice.
      </>
    ),
    sources: (date: string) => `Appeal rules checked against official sources on ${date}:`,
  },
};

export type Strings = typeof en;

const ko: Strings = {
  toggleLabel: "언어",
  hero: {
    title: "메디케어 어드밴티지 플랜에서 거부당하셨나요? 이의신청을 할 수 있습니다.",
    sub: "대부분은 이의신청을 하지 않습니다. 거부 통지서를 넣으면 몇 분 안에 쉬운 말로 된 설명, 이의신청서 초안, 마감일을 받아 보실 수 있습니다.",
  },
  steps: ["통지서", "내용 이해", "나의 입장", "이의신청서 초안", "보내기와 확인"],
  stepOf: (n, total, label) => `${total}단계 중 ${n}단계: ${label}`,
  progress: "진행 단계",
  back: "뒤로",
  eraseSmall: "이 기기에서 이 이의신청 내용 지우기",
  eraseConfirm: "이 기기에 저장된 이의신청 내용을 지우고 처음부터 다시 시작할까요?",
  busy: {
    reading: "통지서를 읽는 중입니다…",
    photo: "사진을 준비하는 중입니다…",
    drafting: "초안을 작성하는 중입니다…",
  },
  errors: {
    generic: "문제가 발생했습니다. 다시 시도해 주세요.",
    bad_json: "문제가 발생했습니다. 다시 시도해 주세요.",
    missing: "일부 정보가 빠져 있습니다. 이전 단계로 돌아가 다시 시도해 주세요.",
    photo_type: "사진은 JPEG, PNG 또는 WebP 형식이어야 합니다.",
    photo_large: "사진 용량이 너무 큽니다. 더 작은 사진으로 시도해 주세요.",
    photo_off: "이 사이트에서는 아직 사진 읽기 기능이 켜져 있지 않습니다. 통지서 내용을 직접 입력하거나 붙여 넣어 주세요.",
    photo_unreadable: "사진을 읽지 못했습니다. 밝은 곳에서 더 선명하게 찍거나, 내용을 붙여 넣어 주세요.",
    photo_device: "이 기기에서는 해당 사진을 사용할 수 없습니다.",
    text_short: "내용을 파악할 수 있도록 거부 통지서 전체를 붙여 넣어 주세요.",
    text_long: "거부 통지서치고는 너무 깁니다. 거부 통지서 부분만 붙여 넣어 주세요.",
    pdf: "PDF를 만들지 못했습니다. 대신 내용을 복사해 주세요.",
    copy: "이 브라우저에서는 복사가 막혀 있습니다. 내용을 직접 선택해 복사해 주세요.",
  },
  capture: {
    title: "거부 통지서부터 시작합니다",
    intro:
      "메디케어 어드밴티지 플랜에서 받은 통지서를 입력하거나 붙여 넣으세요. 사진을 찍어도 됩니다. 통지서는 영어 원문 그대로 넣어 주세요. 내용을 한국어로 설명해 드리고 이의신청서 초안 작성을 도와드립니다.",
    pasteLabel: "통지서 내용 붙여 넣기",
    pasteHint: "가능하면 통지서 전체를 넣어 주세요. 날짜와 거부 이유가 특히 중요합니다.",
    explain: "이 통지서 설명 보기",
    usePhoto: "사진으로 올리기",
    photoAria: "거부 통지서 사진",
    multiPage: "여러 장짜리 통지서라면 거부 이유와 날짜가 있는 쪽을 찍거나, 내용을 붙여 넣어 주세요.",
    sample: (button) => <>통지서가 지금 없으신가요? {button}를 눌러 어떻게 작동하는지 볼 수 있습니다.</>,
    sampleButton: "가상의 예시 통지서 불러오기",
    privacyTitle: "개인정보 보호",
    privacyBody:
      "계정을 만들지 않으며, 통지서를 저희 서버에 보관하지 않습니다. 진행 내용은 이 기기의 이 브라우저에만 저장되고 언제든 지울 수 있습니다. 통지서를 읽고 초안을 작성하기 위해 통지서 내용이 AI 서비스로 전송됩니다.",
  },
  understand: {
    title: "이 통지서의 의미",
    oosTitle: "아직 저희가 다루지 않는 종류의 거부일 수 있습니다",
    oosBody: (
      <>
        Overturned는 현재 한 가지 경우만 다룹니다. 메디케어 어드밴티지 플랜이 치료를 <em>받기 전에</em> 승인을 거부한 경우입니다.
        아래 마감일이 이 통지서에는 적용되지 않을 수 있습니다. 계속 진행하셔도 되지만, 모든 내용을 통지서와 대조하거나
        1-800-MEDICARE로 전화해 확인하세요.
      </>
    ),
    planWords: "플랜이 쓴 원문:",
    translating: "설명을 번역하는 중입니다…",
    notTranslated: "지금은 이 설명을 번역하지 못해 처음 작성된 언어로 보여 드립니다.",
    helpsTitle: "이런 거부에 보통 도움이 되는 것",
    checkTitle: "꼭 다시 확인하세요",
    keywordReader:
      "이 통지서는 AI가 아니라 간단한 키워드 방식으로 읽었기 때문에 아래 정보가 빠졌거나 틀렸을 수 있습니다. 하나씩 통지서와 대조해 주세요.",
    warn: {
      not_ma:
        "메디케어 어드밴티지 거부 통지서인지 분명하지 않습니다. 여기에 나오는 마감일은 메디케어 어드밴티지(파트 C) 플랜에만 적용됩니다.",
      payment:
        "이미 받은 치료에 대한 비용 지급 거부일 수 있습니다. 지급 거부 이의신청은 일정이 다릅니다(플랜의 결정 기한은 60일).",
      part_d: "파트 D 처방약 거부일 수 있습니다. 파트 D는 이의신청 절차가 따로 있습니다.",
      no_date: "통지서의 날짜를 찾지 못했습니다. 직접 입력해 주세요. 마감일은 그 날짜부터 계산됩니다.",
    },
    detailsTitle: "아래 정보를 통지서와 대조해 주세요",
    detailsIntro: "통지서에서 읽어 온 정보입니다. 틀렸거나 비어 있는 곳을 고쳐 주세요. 영어로 적힌 그대로 두시면 됩니다.",
    noticeDate: "통지서 날짜",
    noticeDateHint: "통지서에 인쇄된 날짜입니다. 마감일은 이 날짜부터 계산됩니다.",
    planName: "플랜 이름",
    whatDenied: "거부된 항목",
    memberId: "가입자 번호(Member ID)",
    refNumber: "참조 번호(Reference number)",
    whereSend: "이의신청서를 보낼 곳",
    whereSendHint: "통지서에 인쇄된 이의신청 우편 주소를 영어 그대로 적어 주세요.",
    fax: "이의신청 팩스 번호(있는 경우)",
    kind: "거부 유형",
    kindHint: "저희가 잘못 판단했다면 바꿔 주세요. 초안 내용이 달라집니다.",
    requested: "요청했던 것",
    reqService: "진료, 입원, 검사 또는 의료 장비",
    reqDrug: "병원이나 클리닉에서 투여하는 약(파트 B 약)",
    next: "나의 입장 적으러 가기",
  },
  deadline: {
    title: "마감일",
    enterDate: `통지서에 인쇄된 날짜를 입력하면 마감일을 볼 수 있습니다. 보통 그 날짜로부터 ${D}일입니다.`,
    overdue: (date) => (
      <>
        {D}일 기한이 <strong>{date}</strong>에 끝난 것으로 보입니다. 늦어진 데 타당한 사유가 있다면 플랜에 늦은 이의신청을
        받아 달라고 요청할 수 있습니다. 가능한 한 빨리 보내세요.
      </>
    ),
    mustReceive: (date) => (
      <>
        플랜이 <strong>{date}</strong>까지 이의신청서를 <em>받아야</em> 합니다.
      </>
    ),
    daysLeft: (n) => (n === 0 ? "오늘이 마감일입니다" : `${n}일 남았습니다`),
    dontWait: (weekend) =>
      `마지막 날까지 기다리지 마세요. 우편은 일주일이 걸릴 수 있습니다${weekend ? ". 게다가 이 날짜는 주말입니다" : ""}. 적어도 10일 전에 보내는 것을 목표로 하세요.`,
    confirm: (
      <>
        <strong>이 날짜를 본인의 통지서에서 꼭 확인하세요.</strong> 저희는 메디케어 일반 규정에 따라 통지서 날짜로부터 달력
        기준 {D}일을 계산합니다. 통지서에 적힌 내용이 최종 기준입니다.
      </>
    ),
  },
  facts: {
    title: "나의 입장",
    intro: (
      <>
        쉬운 말로 쓰시면 됩니다. 서명할 사람의 입장에서 써 주세요. 환자 본인이 서명하면 &ldquo;저는&rdquo;, 대신 서명하신다면
        &ldquo;저희 어머니는&rdquo;, &ldquo;저희 아버지는&rdquo;처럼 쓰시면 됩니다. 사실이라고 알고 있는 것만 적고, 확실하지
        않은 것은 건너뛰셔도 됩니다. 편지에 더 필요한 내용은 다음 단계에서 다시 여쭤봅니다.
      </>
    ),
    languageNote:
      "한국어로 쓰셔도 됩니다. 이의신청서에는 영어로 번역되어 들어갑니다. 이름은 번역하지 않으니 플랜 카드에 적힌 영문 그대로 적어 주세요. 주소도 번역하지 않습니다.",
    nameInEnglish: "이름은 번역되지 않습니다. 플랜 카드에 적힌 그대로 영문으로 적어 주세요.",
    addressInEnglish: "주소는 번역되지 않습니다. 우편물이 배달되는 영문 주소 그대로 적어 주세요.",
    whoSigns: "누가 편지에 서명하나요?",
    signPatient: (
      <>
        <strong>환자 본인.</strong> 가장 간단합니다. 부모님을 돕고 계신다면 함께 작성하고 부모님이 서명하시게 하세요.
      </>
    ),
    signRep: (link) => (
      <>
        <strong>제가 환자를 대신해서.</strong> 플랜에 서명된 {link("대리인 지정 양식(Appointment of Representative)")} 또는 의료
        위임장 같은 법적 서류를 내야 합니다.
      </>
    ),
    patientName: "환자 이름(영문)",
    patientNameHint: "플랜 카드에 적힌 그대로.",
    yourName: "본인 이름(영문)",
    address: "답변을 받을 우편 주소",
    phone: "전화번호",
    why: "이 치료가 왜 필요한가요?",
    whyHint: "어떤 일이 있었는지, 의사가 무엇을 왜 권했는지 적어 주세요.",
    tried: "이미 시도해 본 것은 무엇인가요?",
    triedHint: "다른 치료, 재활, 약과 그 경과. 없으면 비워 두세요.",
    harm: "이 치료가 늦어지거나 거부되면 어떻게 되나요?",
    harmHint: "집에서의 안전, 통증, 낙상 위험, 상태 악화 등.",
    doctor: "담당 의사 이름(영문)",
    doctorSupports: "의사가 이 이의신청을 지지하는 소견서를 써 줄 예정입니다.",
    doctorSupportsHint: "꼭 요청해 보세요. 함께 보낼 수 있는 가장 강력한 자료인 경우가 많습니다.",
    fast: `신속 이의신청(${FAST}시간)을 요청합니다.`,
    fastHint: (window) =>
      `${window}을 기다리면 환자의 건강이나 회복 능력에 심각한 해가 될 수 있을 때 선택하세요. 의사가 신속 이의신청을 요청하면 플랜은 받아들여야 합니다. 그래서 의사 사무실에서 플랜에 직접 전화하는 것이 가장 빠른 경우가 많습니다.`,
    late: "왜 기한 안에 이의신청서를 보내지 못했나요?",
    lateHint: `${D}일 기한이 지난 것으로 보입니다. 중병이었거나 통지서를 받지 못한 것처럼 타당한 사유가 있으면 플랜이 늦은 이의신청을 받아 줄 수 있습니다.`,
    submit: "초안 작성하기",
  },
  letter: {
    title: "이의신청서 초안",
    intro: "초안입니다. 한 줄씩 읽고 사실과 맞는지 확인해 주세요. 서명하는 사람은 본인입니다. 편지를 직접 고치셔도 됩니다.",
    englishNote: "이의신청서는 플랜이 읽을 수 있도록 영어로 작성됩니다. 플랜에는 이 영어 편지를 보내세요.",
    translated: "한국어로 쓰신 답변을 AI가 영어로 번역해 편지에 넣었습니다. 영어 문장이 뜻하신 내용과 맞는지 확인해 주세요.",
    translationFailed:
      "지금은 한국어 답변 중 일부를 번역하지 못해 아직 편지에 들어가지 않았습니다. 아래에 다시 표시해 두었으니 '편지에 반영하기'를 눌러 다시 시도해 주세요.",
    translationUnavailable:
      "지금 이 사이트에서 번역 기능이 작동하지 않아 한국어 답변이 아직 편지에 들어가지 않았습니다. 아래에 다시 표시해 두었으니 나중에 '편지에 반영하기'를 다시 눌러 보시거나 영어로 답해 주세요.",
    hangulLeft:
      "편지에 아직 한글이 남아 있습니다. PDF에서 제대로 인쇄되지 않으며, 플랜에는 영어 편지를 보내야 합니다. 보내기 전에 영어로 바꿔 주세요.",
    needed: (n) => `추가로 필요한 정보 ${n}개`,
    neededIntro: "여기에 답하시면 편지에 넣어 드립니다. 한국어로 답하셔도 영어로 번역되어 들어갑니다. 편지를 직접 고칠 필요가 없습니다.",
    neededSkip: "아직 모르는 것은 건너뛰셔도 됩니다. 나중에 다시 답할 수 있습니다.",
    update: "편지에 반영하기",
    genericQuestion: (what) => `다음 정보를 알려 주세요: ${what}`,
    editedConfirm: "편지를 직접 고치셨습니다. 반영하기를 누르면 편지가 새로 작성되어 고친 내용이 사라집니다. 계속할까요?",
    textareaLabel: "이의신청서 내용",
    tailored: "주장 부분은 쓰신 내용을 바탕으로 AI가 작성했습니다. 틀릴 수 있으니 모든 사실이 맞는지 확인해 주세요.",
    standard: "이 초안은 이런 거부 유형에 쓰는 저희 기본 문구를 사용했습니다.",
    rules:
      "편지에 인용된 규정은 메디케어 연방 규정입니다. 내 경우에 맞는지는 의사 사무실이나 무료 메디케어 상담원의 도움을 받아 확인할 수 있습니다.",
    pdf: "인쇄용 PDF 내려받기",
    copy: "내용 복사",
    copied: "복사됨",
    next: "다음: 보내기와 확인",
    backToAnswers: "답변을 고치러 돌아가기",
  },
  next: {
    title: "보내고 진행 상황 확인하기",
    calendar: "마감일을 내 캘린더에 추가",
    ics: {
      summary: (plan) => `이의신청 마감일: 플랜이 이의신청서를 받아야 하는 날${plan ? ` (${plan})` : ""}`,
      description: (service, date) =>
        `${service || "요청한 치료"} 거부에 대한 이의신청서를 플랜이 받아야 하는 마지막 날: ${date}. 이 날짜보다 충분히 일찍 보내고 배달 증빙을 보관하세요. 마감일은 거부 통지서에서 꼭 확인하세요.`,
      alarm: (days) => `이의신청 마감 ${days}일 전`,
    },
    beforeTitle: "보내기 전에",
    checklistStart: ["초안 단계에 남은 질문에 모두 답한 뒤 편지를 인쇄해 서명합니다.", "거부 통지서 사본을 첨부합니다."],
    gather: (item) => `가능하면 준비하세요: ${item}`,
    checklistRep: "서명된 대리인 지정 양식 또는 위임장을 첨부합니다.",
    checklistEnd: [
      "보내는 서류는 모두 사본을 보관합니다.",
      "증빙이 남는 방법으로 보냅니다. 배달 증명 등기우편(certified mail with return receipt) 또는 전송 확인서가 나오는 팩스가 좋습니다.",
      "며칠 뒤 플랜에 전화해 받았는지 확인합니다. 날짜와 통화한 사람의 이름을 적어 두세요.",
    ],
    whenTitle: "플랜은 언제 답하나요?",
    whenBody: (window, fast) => (
      <>
        플랜은 이의신청서를 받은 뒤 <strong>{window}</strong> 안에 결정해야 합니다
        {fast ? "(플랜이 신속 처리 대상이라고 인정하는 경우)" : ""}.
      </>
    ),
    received: "플랜이 이의신청서를 받은 날짜",
    receivedHint: "배달 확인을 받은 뒤 입력하세요.",
    expectBy: (date) => (
      <>
        <strong>{date}</strong>까지 서면 결정이 와야 합니다. 그때까지 소식이 없으면 플랜과 1-800-MEDICARE에 전화하세요.
      </>
    ),
    againTitle: "플랜이 또 거부하면",
    againIntro: "이번 이의신청은 가능한 다섯 단계 중 첫 단계입니다. 대부분은 뒤 단계까지 갈 필요가 없습니다.",
    helpTitle: "사람에게 받는 무료 도움",
    ship: "주 건강보험 지원 프로그램(SHIP)",
    shipNote: ": 모든 주에 있는 무료, 중립적인 메디케어 상담 서비스입니다.",
    phone: (
      <>
        <strong>1-800-MEDICARE</strong> (1-800-633-4227), 언제든지.
      </>
    ),
    interpreter: "1-800-MEDICARE에 전화해 통역사(interpreter)를 요청하면 한국어로 무료 도움을 받을 수 있습니다.",
    medicareLink: "Medicare.gov: 메디케어 건강 플랜 이의신청 안내(영문)",
    backToLetter: "편지로 돌아가기",
    startOver: "지우고 처음부터 다시",
  },
  footer: {
    disclaimer: (
      <>
        <strong className="text-ink">Overturned는 법률 자문이나 의료 자문이 아닙니다.</strong> 정보 제공과 문서 초안 작성을 돕는
        도구입니다. 메디케어, 미국 정부, 어떤 건강 플랜과도 관련이 없습니다. 마감일과 안내 사항은 반드시 본인의 거부 통지서에서
        확인하세요.
      </>
    ),
    sources: (date) => `이의신청 규정은 ${date}에 다음 공식 자료(영문)와 대조해 확인했습니다:`,
  },
};

export const STRINGS: Record<Locale, Strings> = { en, ko };

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", ko: "한국어" };
