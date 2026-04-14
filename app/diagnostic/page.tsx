export default function Diagnostic() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return (
    <div className="p-8 bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">BeFast Diagnostic</h1>
      <div className="space-y-4">
        <div>
          <p className="font-semibold">NEXT_PUBLIC_SUPABASE_URL:</p>
          <p className={supabaseUrl ? "text-green-600" : "text-red-600"}>
            {supabaseUrl ? "✓ Configured" : "✗ Missing"}
          </p>
        </div>
        <div>
          <p className="font-semibold">NEXT_PUBLIC_SUPABASE_ANON_KEY:</p>
          <p className={supabaseKey ? "text-green-600" : "text-red-600"}>
            {supabaseKey ? "✓ Configured" : "✗ Missing"}
          </p>
        </div>
        <div className="mt-8">
          <a href="/login" className="text-blue-600 underline">
            Go to Login →
          </a>
        </div>
      </div>
    </div>
  )
}
