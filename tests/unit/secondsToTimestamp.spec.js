import secondsToTimestamp from '../../src/timestamp';

describe('secondsToTimestamp spec', () => {
    it('handles positive values', () => {
        let s = 120;
        let t = secondsToTimestamp(s);
        expect(t).toMatch("02:00");
    });

    it('handles negative values', () => {
        let s = -120;
        let t = secondsToTimestamp(s);
        expect(t).toMatch("-02:00");
    });
});
