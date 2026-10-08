import {z} from 'zod';

/** Shared route validator for native Companion TFT recording.
 * The round pattern must match normal values like "1-1" and "4-2" – an
 * escaped backslash in a JS regexp makes every real checkpoint fail.
 */
const optionalCount=z.number().int().finite().nonnegative().optional();
export const tftPointSchema=z.object({
  clientPointId:z.string().min(1).max(160),
  at:z.string().datetime(),
  round:z.string().regex(/^[1-9]\d?-[0-9]\d?$/),
  eventKind:z.enum(['MATCH_START','ROUND_START','ROUND_END','MATCH_END','CHECKPOINT']),
  gold:optionalCount,
  level:z.number().int().min(1).max(12).optional(),
  xp:optionalCount,hp:optionalCount,placement:optionalCount,
  shopRefreshes:optionalCount,purchases:optionalCount,
  boardPower:optionalCount,boardUnits:optionalCount,benchUnits:optionalCount,completedItems:optionalCount,
  board:z.array(z.record(z.unknown())).max(12).optional(),
  bench:z.array(z.record(z.unknown())).max(12).optional(),
  shop:z.array(z.record(z.unknown())).max(8).optional(),
});
export const tftEnvelopeSchema=z.discriminatedUnion('action',[
  z.object({game:z.literal('TFT'),action:z.literal('START'),pseudoMatchId:z.string().min(3).max(180),startedAt:z.string().datetime().optional(),metadata:z.record(z.unknown()).optional()}),
  z.object({game:z.literal('TFT'),action:z.literal('POINT'),pseudoMatchId:z.string().min(3).max(180),point:tftPointSchema}),
  z.object({game:z.literal('TFT'),action:z.literal('END'),pseudoMatchId:z.string().min(3).max(180),endedAt:z.string().datetime().optional(),point:tftPointSchema.optional()}),
]);
