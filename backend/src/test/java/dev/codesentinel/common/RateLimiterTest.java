package dev.codesentinel.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class RateLimiterTest {
    @Test
    void blocksAfterLimitAndRecoversAfterWindow() {
        RateLimiter l = new RateLimiter(3, 1000);
        assertTrue(l.allow("a", 0));
        assertTrue(l.allow("a", 10));
        assertTrue(l.allow("a", 20));
        assertFalse(l.allow("a", 30));
        assertTrue(l.allow("b", 30), "other clients are independent");
        assertTrue(l.allow("a", 1021), "window slid past the first hits");
    }

    @Test
    void expiresHitAtExactWindowBoundary() {
        RateLimiter limiter = new RateLimiter(1, 1000);

        assertTrue(limiter.allow("client", 5000L));

        assertFalse(limiter.allow("client", 5999L),
                "the previous hit must still be inside the window");

        assertTrue(limiter.allow("client", 6000L),
                "the previous hit expires at the exact window boundary");
    }

    @Test
    void zeroDisables() {
        RateLimiter l = new RateLimiter(0, 1000);
        for (int i = 0; i < 100; i++) assertTrue(l.allow("a", i));
    }

    @Test
    void onlyAbusableEndpointsAreLimited() {
        assertTrue(RateLimitFilter.limited("POST", "/api/auth/login"));
        assertTrue(RateLimitFilter.limited("POST", "/api/assignments/4/submissions"));
        assertTrue(RateLimitFilter.limited("POST", "/api/auth/password"));
        assertFalse(RateLimitFilter.limited("GET", "/api/assignments/4/submissions"));
        assertFalse(RateLimitFilter.limited("GET", "/api/courses"));
    }
}
