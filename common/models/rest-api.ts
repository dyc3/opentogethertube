type OttResponseBody<T = undefined, E extends OttApiError = OttApiError> = OttSuccessResponseBody<T> | OttErrorResponseBody<E>

type OttSuccessResponseBody<T = undefined> = T & {
	success: true
}

/**
 * Used for /api/data endpoints.
 */
type OttStaticDataResponseBody<T> = T

interface OttErrorResponseBody<E extends OttApiError = OttApiError> {
	success: false
	error: E
}

interface OttApiError {
	name: string
	message: string
}
