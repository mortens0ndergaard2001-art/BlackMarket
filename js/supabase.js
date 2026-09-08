window.CasinoSupabase = (() => {
  const C = window.CasinoConfig;
  const Store = window.CasinoStore;

  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("Supabase JS kunne ikke indlæses fra CDN.");
  }

  const client = window.supabase.createClient(
    C.SUPABASE_URL,
    C.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: { eventsPerSecond: 20 }
      }
    }
  );

  async function ensureAnonymousSession() {
    Store.set("connection", "connecting");

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;

    let session = sessionData.session;
    if (!session) {
      const { data, error } = await client.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }

    Store.patch({
      session,
      userId: session?.user?.id || null,
      connection: "online"
    });

    return session;
  }

  client.auth.onAuthStateChange((_event, session) => {
    Store.patch({
      session,
      userId: session?.user?.id || null
    });
  });

  return { client, ensureAnonymousSession };
})();
