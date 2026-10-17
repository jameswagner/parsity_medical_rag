import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
	title: 'Medical Data Explorer',
	description: 'Browse the synthetic patient database behind the RAG course project.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<main>
					<div className="nav">
						<Link href="/"><strong>Medical Data Explorer</strong></Link>
						<span className="muted small">Synthetic Synthea data · zero real patients · read-only</span>
					</div>
					{children}
				</main>
			</body>
		</html>
	);
}
