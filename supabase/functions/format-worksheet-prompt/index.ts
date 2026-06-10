// v6.9.7 — Edge Function that builds the worksheet prompt server-side.
// IP protection: language-style ladder + CEFR ladder + exercise specs were
// previously visible in the browser bundle (see src/utils/promptFormatter.ts
// pre-v6.9.7). Moving this logic to the server denies casual scraping of the
// "Heart of Edooqoo" prompt scaffolding while keeping the worksheet engine
// prompt itself untouched (that lives in `generate-worksheet`).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface FormDataInput {
  lessonTopic?: string
  lessonGoal?: string
  englishLevel?: string
  languageStyle?: number
  teachingPreferences?: string
  additionalInformation?: string
  selectedExercises?: string[]
  exerciseFocusMap?: Record<string, unknown>
}

const getLanguageStyleDescription = (value: number): string => {
  if (value === 1) return '(very casual - slang, contractions)'
  if (value === 2) return '(casual - relaxed, friendly)'
  if (value === 3) return '(neutral - balanced style)'
  if (value === 4) return '(formal - professional tone)'
  return '(very formal - academic style)'
}

const buildPrompt = (data: FormDataInput): string => {
  const promptLines: string[] = []

  promptLines.push(`lessonTopic: ${data.lessonTopic ?? ''}`)
  promptLines.push(`lessonGoal: ${data.lessonGoal ?? ''}`)
  promptLines.push(`englishLevel: ${data.englishLevel ?? ''}`)

  const languageStyle = data.languageStyle || 3
  promptLines.push(
    `languageStyle: ${languageStyle}/5 ${getLanguageStyleDescription(languageStyle)}`,
  )

  if (data.teachingPreferences) {
    promptLines.push(`grammarFocus: ${data.teachingPreferences}`)
  }
  if (data.additionalInformation) {
    promptLines.push(`additionalInformation: ${data.additionalInformation}`)
  }
  if (data.selectedExercises && data.selectedExercises.length > 0) {
    promptLines.push(`selectedExercises: ${data.selectedExercises.join(', ')}`)
  }
  if (data.exerciseFocusMap && Object.keys(data.exerciseFocusMap).length > 0) {
    promptLines.push(`exerciseFocusMap: ${JSON.stringify(data.exerciseFocusMap)}`)
  }

  promptLines.push(`\nLANGUAGE STYLE GUIDELINES (${languageStyle}/5):`)
  if (languageStyle === 1) {
    promptLines.push(`- Use very casual, conversational language with heavy use of contractions (I'm, you're, can't, won't, that's)`)
    promptLines.push(`- Include everyday slang, informal expressions, and colloquialisms where appropriate`)
    promptLines.push(`- Use shorter, simpler sentences with relaxed grammar and informal structure`)
    promptLines.push(`- Embrace conversational fillers and natural speech patterns`)
    promptLines.push(`- Examples: "Hey, what's up?", "That's totally awesome!", "No way!", "Wanna grab a coffee?", "I'm like totally into that"`)
  } else if (languageStyle === 2) {
    promptLines.push(`- Use casual, relaxed language with regular contractions and friendly tone`)
    promptLines.push(`- Include common informal expressions and everyday language`)
    promptLines.push(`- Keep sentences moderately simple but well-structured`)
    promptLines.push(`- Examples: "How's it going?", "That sounds really great!", "I'd love to", "Let's hang out", "It's pretty cool"`)
  } else if (languageStyle === 3) {
    promptLines.push(`- Use neutral, balanced language that's neither too casual nor too formal`)
    promptLines.push(`- Mix contractions with full forms naturally and appropriately`)
    promptLines.push(`- Use standard expressions and commonly understood idioms`)
    promptLines.push(`- Examples: "How are you doing?", "That sounds excellent!", "I would like to", "Let's meet up", "It's interesting"`)
  } else if (languageStyle === 4) {
    promptLines.push(`- Use formal, professional language with proper grammar and structure`)
    promptLines.push(`- Prefer full forms over contractions (I am, you are, cannot, will not)`)
    promptLines.push(`- Use sophisticated vocabulary and well-constructed sentences`)
    promptLines.push(`- Examples: "How are you today?", "That is excellent!", "I would be delighted to", "Shall we arrange a meeting?", "It is quite remarkable"`)
  } else {
    promptLines.push(`- Use very formal, academic language with sophisticated vocabulary and complex structures`)
    promptLines.push(`- Strictly avoid contractions and maintain formal grammatical constructions throughout`)
    promptLines.push(`- Employ elevated vocabulary, complex sentence structures, and academic tone`)
    promptLines.push(`- Use precise, scholarly language and formal expressions`)
    promptLines.push(`- Examples: "How do you do?", "That is most exceptional!", "I would be most honored to", "Shall we schedule a formal appointment?", "It is extraordinarily fascinating"`)
  }

  promptLines.push(`\nCEFR LEVEL GUIDELINES (${data.englishLevel ?? ''}):`)
  if (data.englishLevel === 'A1/A2') {
    promptLines.push(`- Use simple, basic vocabulary and elementary grammatical structures appropriate for beginners`)
    promptLines.push(`- Focus on everyday topics, common situations, and concrete subjects (family, food, weather, hobbies)`)
    promptLines.push(`- Keep sentences short and straightforward with present simple, present continuous, and basic past tense`)
    promptLines.push(`- Avoid complex clauses, abstract concepts, and advanced vocabulary`)
    promptLines.push(`- Examples: "I like pizza", "She is working now", "We went to the park yesterday"`)
  } else if (data.englishLevel === 'B1/B2') {
    promptLines.push(`- Use intermediate vocabulary with more varied grammatical structures including conditionals and perfect tenses`)
    promptLines.push(`- Include topics related to work, travel, personal experiences, opinions, and abstract ideas`)
    promptLines.push(`- Use compound and some complex sentences with relative clauses and linking words`)
    promptLines.push(`- Introduce phrasal verbs, idiomatic expressions, and more nuanced vocabulary`)
    promptLines.push(`- Examples: "If I had known, I would have come earlier", "I've been learning English for five years", "Although it was raining, we decided to go out"`)
  } else if (data.englishLevel === 'C1/C2') {
    promptLines.push(`- Use advanced, sophisticated vocabulary with complex grammatical structures and subtle nuances`)
    promptLines.push(`- Include abstract topics, professional contexts, academic discussions, and complex social issues`)
    promptLines.push(`- Employ complex sentence structures with multiple clauses, inversion, and advanced discourse markers`)
    promptLines.push(`- Use idiomatic language, collocations, and precise terminology appropriate to the context`)
    promptLines.push(`- Examples: "Had I known the implications, I would have reconsidered my decision", "Not only did she excel academically, but she also demonstrated exceptional leadership qualities"`)
  }

  return promptLines.join('\n')
}

// In-memory rate limiter (per-instance). Edge runtime keeps warm instances
// for ~minutes — sufficient to throttle scraping bots holding a valid JWT.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 60
const RATE_LIMIT_WINDOW_MS = 60_000

const checkRateLimit = (key: string): boolean => {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count += 1
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // v6.9.52 — Dual-auth: accept either a real Supabase user JWT
    // (authenticated teacher) or the project's Supabase anon/publishable
    // key (anonymous public worksheet generator on the marketing site).
    // verify_jwt is disabled in supabase/config.toml so OPTIONS and anon
    // requests can reach this handler.
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const authHeader = req.headers.get('Authorization') ?? ''
    const bearer = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''
    const apikeyHeader = (req.headers.get('apikey') ?? '').trim()
    const ip =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown'

    let rateLimitKey: string | null = null

    // Authenticated mode: bearer is a real user JWT, not the anon key.
    if (bearer && bearer !== anonKey) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          anonKey,
          { global: { headers: { Authorization: `Bearer ${bearer}` } } },
        )
        const { data: userData, error: userError } =
          await supabase.auth.getUser(bearer)
        if (!userError && userData?.user) {
          rateLimitKey = `user:${userData.user.id}`
        }
      } catch (_authErr) {
        // fall through to anon attempt
      }
    }

    // Anonymous public generator: caller must present the project anon key
    // on either Authorization: Bearer <anon> or apikey: <anon>.
    if (!rateLimitKey) {
      const presentedAnon =
        (bearer && bearer === anonKey) || (apikeyHeader && apikeyHeader === anonKey)
      if (presentedAnon) {
        rateLimitKey = `anon:${ip}`
      }
    }

    if (!rateLimitKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!checkRateLimit(rateLimitKey)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const formData = body?.formData
    if (!formData || typeof formData !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid body: formData required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt = buildPrompt(formData as FormDataInput)
    return new Response(JSON.stringify({ prompt }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})