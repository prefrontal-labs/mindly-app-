import type { SupabaseClient } from '@supabase/supabase-js'
import { defaultStudentState } from './types'
import type { StudentState } from './types'

export async function loadStudentState(
  supabase: SupabaseClient,
  userId: string,
  examDomain?: string
): Promise<StudentState> {
  const { data } = await supabase
    .from('tutor_sessions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!data) {
    return { ...defaultStudentState(userId), examDomain: examDomain || 'general' }
  }

  return {
    userId,
    sessionPhase: data.session_phase || 'warmup',
    conceptMastery: data.concept_mastery || {},
    misconceptions: data.misconceptions || [],
    confidenceCalibration: data.confidence_calibration || 'unknown',
    consecutiveFailures: data.consecutive_failures || 0,
    consecutiveSuccesses: data.consecutive_successes || 0,
    pendingQuestion: data.pending_question || null,
    hintsGiven: data.hints_given || 0,
    lastConceptsTested: data.last_concepts_tested || [],
    sessionCount: data.session_count || 0,
    messagesInSession: data.messages_in_session || 0,
    pendingConcept: data.pending_concept || null,
    awaitingConfidenceRating: data.awaiting_confidence_rating || false,
    examDomain: examDomain || data.exam_domain || 'general',
  }
}

export async function saveStudentState(
  supabase: SupabaseClient,
  state: StudentState
): Promise<void> {
  await supabase.from('tutor_sessions').upsert(
    {
      user_id: state.userId,
      session_phase: state.sessionPhase,
      concept_mastery: state.conceptMastery,
      misconceptions: state.misconceptions,
      confidence_calibration: state.confidenceCalibration,
      consecutive_failures: state.consecutiveFailures,
      consecutive_successes: state.consecutiveSuccesses,
      pending_question: state.pendingQuestion,
      hints_given: state.hintsGiven,
      last_concepts_tested: state.lastConceptsTested,
      session_count: state.sessionCount,
      messages_in_session: state.messagesInSession,
      pending_concept: state.pendingConcept,
      awaiting_confidence_rating: state.awaitingConfidenceRating,
      exam_domain: state.examDomain,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
}
