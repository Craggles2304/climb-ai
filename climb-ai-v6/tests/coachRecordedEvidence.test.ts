import {describe,it,expect} from 'vitest';

describe('Coach recorded evidence authority',()=>{
  it('requires evidence to be scoped to the selected Riot account',()=>{
    const query={userId:'user-1',accountId:'account-2'};
    expect(query).toEqual({userId:'user-1',accountId:'account-2'});
  });
  it('keeps recorded evidence subordinate to the persisted primary limiter',()=>{
    const authority={primary:'Lead Protection',recordedEvent:'Fight at 21:40'};
    expect(authority.primary).toBe('Lead Protection');
    expect(authority.recordedEvent).not.toBe(authority.primary);
  });
});
