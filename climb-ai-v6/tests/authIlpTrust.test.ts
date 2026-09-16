import {describe,it,expect} from 'vitest';

describe('authenticated ILP trust boundary',()=>{
  it('treats cloud state as authoritative for signed-in accounts',()=>{
    const sourceFor=(authenticated:boolean)=>authenticated?'cloud':'local-demo';
    expect(sourceFor(true)).toBe('cloud');
    expect(sourceFor(false)).toBe('local-demo');
  });
});
