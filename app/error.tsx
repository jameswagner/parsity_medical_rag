'use client';

// Next hides server error messages in production; the digest matches the line in `vercel logs`
export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
	return (
		<>
			<h1>Something broke</h1>
			<p className="muted">The database query failed. Check the function logs for this digest.</p>
			{error.digest && <p><code className="small">{error.digest}</code></p>}
		</>
	);
}
