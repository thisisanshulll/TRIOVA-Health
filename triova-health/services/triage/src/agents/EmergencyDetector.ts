export const EMERGENCY_KEYWORDS = [
  'chest pain', "can't breathe", 'can not breathe', 'heart attack',
  'stroke', 'unconscious', 'passed out', 'bleeding heavily', 'blood',
  'suicide', 'kill myself', 'severe pain', 'worst pain', 'thunderclap',
  "can't speak", 'face drooping', 'arm weakness', 'severe allergic',
  'anaphylaxis', 'swallowed', 'poisoned', 'overdose',
  'nahi saans aa rahi', 'dil ka dora', 'behosh', 'khoon',
];

export class EmergencyDetector {
  detect(text: string): boolean {
    const lower = text.toLowerCase();
    return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
  }

  detectWithKeyword(text: string): { isEmergency: boolean; keyword?: string } {
    const lower = text.toLowerCase();
    for (const kw of EMERGENCY_KEYWORDS) {
      if (lower.includes(kw)) {
        return { isEmergency: true, keyword: kw };
      }
    }
    return { isEmergency: false };
  }
}
