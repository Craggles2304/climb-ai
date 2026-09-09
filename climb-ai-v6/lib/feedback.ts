/**
 * Feedback vocabulary, shared by the prompt and the ingest route so the two can
 * never drift into accepting different reason codes.
 */

export const FEEDBACK_REASONS=[
  'too_generic','incorrect','too_complicated','not_relevant','already_knew','other',
] as const;

export type FeedbackReason=typeof FEEDBACK_REASONS[number];

/** Reason codes paired with the label shown to the player. */
export const FEEDBACK_REASON_LABELS:[FeedbackReason,string][]=[
  ['too_generic','Too generic'],
  ['incorrect','Incorrect'],
  ['too_complicated','Too complicated'],
  ['not_relevant','Not relevant to me'],
  ['already_knew','Already knew this'],
  ['other','Something else'],
];

export const FEEDBACK_SURFACES=['leak_price','ilp_task','analysis','coach','mission'] as const;
export type FeedbackSurface=typeof FEEDBACK_SURFACES[number];
