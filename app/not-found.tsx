import Link from 'next/link';

export default function NotFound() {
	return (
		<>
			<h1>Not found</h1>
			<p className="muted">No patient or query with that id. <Link href="/">Back to search</Link></p>
		</>
	);
}
