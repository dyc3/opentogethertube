import secondsToTimestamp from '../../../src/timestamp';

describe('secondsToTimestamp spec', () => {
    it('handles positive values', () => {
        let t = secondsToTimestamp(120);
        expect(t).toMatch("02:00");
    });

    it('handles negative values', () => {
        let t = secondsToTimestamp(-120);
        expect(t).toMatch("-02:00");
    });

    it('handles time spans over an hour', () => {
        let t = secondsToTimestamp(5400);
        expect(t).toMatch("01:30:00");
    });
});
