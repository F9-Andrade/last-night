import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HostingPolicy} from '../src/network/hosting-policy.ts';

test('host departure closes every unauthorized participant by default',()=>{
 const policy=new HostingPolicy(1,'session-a');
 for(const actor of [1,2,3])assert.equal(policy.decision(actor,1,[1,2,3]),'play');
 for(const actor of [2,3])assert.equal(policy.decision(actor,2,[2,3]),'close');
});
test('explicit permission preserves only authorized players, waiting for unauthorized leader to leave',()=>{
 const owner=new HostingPolicy(1,'session-a'),guest=new HostingPolicy(1,'session-a');
 const grant=owner.change(1,3,true)!;assert.ok(guest.accept(1,grant));
 assert.equal(guest.decision(2,2,[2,3]),'close');assert.equal(guest.decision(3,2,[2,3]),'wait');assert.equal(guest.decision(3,3,[3]),'play');
});
test('permission cannot be forged by the elected replacement host or replayed from another session',()=>{
 const policy=new HostingPolicy(1,'session-a');
 assert.equal(policy.change(2,2,true),null);assert.equal(policy.accept(2,{token:'session-a',revision:9,allowed:[2]}),false);
 assert.equal(policy.accept(1,{token:'session-b',revision:9,allowed:[2]}),false);
 for(const allowed of [[2,2],[1],[-1],[NaN],[2,3,4,5]])assert.equal(policy.accept(1,{token:'session-a',revision:9,allowed}),false);
 assert.equal(policy.decision(2,2,[2]),'close');
});
test('revocation and stale messages cannot restore continuation permission',()=>{
 const owner=new HostingPolicy(1,'session-a'),guest=new HostingPolicy(1,'session-a'),grant=owner.change(1,2,true)!;
 assert.ok(guest.accept(1,grant));assert.ok(guest.accept(1,owner.change(1,2,false)));assert.equal(guest.accept(1,grant),false);assert.equal(guest.decision(2,2,[2]),'close');
});
test('permission survives successive authorized host departures without promoting unapproved players',()=>{
 const policy=new HostingPolicy(1,'session-a');policy.change(1,2,true);policy.change(1,3,true);
 assert.equal(policy.decision(3,2,[2,3,4]),'play');assert.equal(policy.decision(4,2,[2,3,4]),'close');assert.equal(policy.decision(3,3,[3]),'play');
});

test('verified database grants replace cached room permissions, including revocation',()=>{
 const policy=new HostingPolicy(1,'session-a');policy.replaceVerified([2,3]);
 assert.equal(policy.decision(3,2,[2,3]),'play');policy.replaceVerified([3]);
 assert.equal(policy.decision(2,2,[2,3]),'close');assert.equal(policy.decision(3,2,[2,3]),'wait');
 policy.replaceVerified([]);assert.equal(policy.decision(3,3,[3]),'close');
});
