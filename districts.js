/* Rhino's Lab: the hub's district list. The one place a district's state lives.
   state: 'open' or 'locked'.
   opens: when a locked district opens by itself (Central Time, the minute its video goes public); null = no date yet.
   To open a district early: set state to 'open'. To keep it locked past its date: set opens to null.
   Preview either look without changing anything: add ?preview=open or ?preview=locked to the hub's address. */
window.RHINO_DISTRICTS = [
  { id: 'd1', name: 'the energy drink',  state: 'locked', opens: '2026-11-20T12:00:00-06:00' },
  { id: 'd2', name: 'the all-nighter',   state: 'locked', opens: '2026-11-20T11:55:00-06:00' },
  { id: 'd3', name: 'out cold',          state: 'locked', opens: null },
  { id: 'd4', name: 'the first workout', state: 'locked', opens: null }
];
