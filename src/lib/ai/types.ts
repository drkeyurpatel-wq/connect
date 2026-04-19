export type ChurnRiskBand = 'low' | 'medium' | 'high' | 'critical';
export type RecommendationStatus = 'pending' | 'shown' | 'accepted' | 'rejected' | 'expired';
export type FeedbackSeverity = 'info' | 'minor' | 'major' | 'critical';
export type AnomalyKind =
  | 'referral_spike'
  | 'conversion_spike'
  | 'agent_close_outlier'
  | 'bot_submission'
  | 'ad_fraud'
  | 'other';
