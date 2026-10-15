import {z} from 'zod';
export const tftAssessmentSchema=z.object({
  round:z.string().regex(/^[1-9]\d?-[0-9]\d?$/),
  verdict:z.enum(['HELPED','HURT','UNCERTAIN']),
  reason:z.string().trim().min(10).max(500),
}).strict();
export const tftSkillSchema=z.enum(['ECONOMY','TEMPO','BOARD_BUILDING','FLEXIBILITY','ITEMS_AUGMENTS','CONVERSION']);
export const tftSessionReviewSchema=z.object({sessionId:z.string().uuid(),skill:tftSkillSchema,assessment:tftAssessmentSchema}).strict();
