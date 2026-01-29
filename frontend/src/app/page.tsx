import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect root path to Dashboard or Upload page
  redirect('/dashboard/anomalies');
}
