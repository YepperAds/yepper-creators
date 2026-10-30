'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock3,
  Film,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  Upload,
} from 'lucide-react';
import { getToken } from '@/app/(adsense)/utils/token';
import styles from './VideoStudio.module.css';

type Plan = 'starter' | 'creator' | 'pro';

interface StudioPlan {
  code: Plan;
  name: string;
  priceRwf: number;
  hoursIncluded: number;
  enabled: boolean;
}

interface StudioJob {
  id: string | number;
  status: string;
  stage_message: string | null;
  progress: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  duration_seconds: number | null;
}

interface StudioUsage {
  trial: { used: number; limit: number; remaining: number };
  subscription: {
    plan: string | null;
    name?: string | null;
    priceRwf?: number;
    status: string | null;
    hoursIncluded: number;
    hoursUsed: number;
    hoursRemaining: number;
    periodEnd: string | null;
  } | null;
  plans: StudioPlan[];
  planRequests: { plan: string; status: string; createdAt: string }[];
  extraHours: { enabled: boolean; priceRwf: number };
  verificationStatus: string;
  limits: {
    maxDurationMinutes: number;
    maxFileSizeGb: number;
    maxDailyJobs: number;
    maxMonthlyJobs: number;
  };
  jobs: StudioJob[];
}

interface UsageResponse {
  success: boolean;
  message?: string;
  data?: StudioUsage;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  || process.env.NEXT_PUBLIC_AD_VIDEO_API_URL
  || 'https://yepper-creators-video-worker.onrender.com';
function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function formatRwf(amount: number) {
  return `RWF ${Number(amount).toLocaleString()}`;
}

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not scheduled'
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function statusLabel(status: string) {
  return status.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const JOB_TIMELINE_STEPS = ['Uploaded', 'Reviewed', 'Processing', 'Ready to download'] as const;

function getJobStatus(status: string) {
  const normalized = status.toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized.includes('reject') || normalized.includes('fail') || normalized.includes('error')) return 'Rejected';
  if (normalized.includes('ready') || normalized.includes('complete') || normalized === 'done') return 'Ready';
  if (normalized.includes('process')) return 'Processing';
  if (normalized.includes('approv')) return 'Approved';
  return 'Pending approval';
}

function getTimelineState(stepIndex: number, status: string) {
  if (status === 'Rejected') {
    if (stepIndex === 0) return 'complete';
    if (stepIndex === 1) return 'rejected';
    return 'upcoming';
  }
  const stageIndex = status === 'Ready' ? 3 : status === 'Processing' ? 2 : status === 'Approved' ? 1 : 0;
  if (stepIndex < stageIndex || status === 'Ready') return 'complete';
  if (stepIndex === stageIndex && stageIndex > 0) return 'current';
  if (stepIndex === 1 && status === 'Pending approval') return 'current';
  return 'upcoming';
}

export default function VideoStudio() {
  const [usage, setUsage] = useState<StudioUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingPlan, setRequestingPlan] = useState<Plan | null>(null);
  const [toast, setToast] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadUsage = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError('');

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/api/social/video-studio/usage`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
        cache: 'no-store',
      });
      const result = await response.json() as UsageResponse;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || 'Video Studio usage could not be loaded.');
      }
      setUsage(result.data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Something went wrong while loading Video Studio.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const trialPercent = useMemo(() => {
    if (!usage?.trial.limit) return 0;
    return Math.min(100, Math.max(0, (usage.trial.used / usage.trial.limit) * 100));
  }, [usage]);

  const pendingPlanRequests = useMemo(
    () => new Set(usage?.planRequests.filter((request) => request.status === 'pending').map((request) => request.plan) || []),
    [usage],
  );

  async function requestPlan(plan: Plan) {
    setRequestingPlan(plan);
    setToast('');
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/api/social/video-studio/plan-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ plan }),
      });
      const result = await response.json() as { success?: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Your plan request could not be sent.');
      }
      setToast(result.message || 'Your plan request has been received.');
      await loadUsage(true);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setRequestingPlan(null);
    }
  }

  const verificationStatus = usage?.verificationStatus?.toLowerCase() || 'unverified';
  const isVerified = ['verified', 'approved', 'complete', 'completed'].includes(verificationStatus);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/connect-accounts">Creator tools</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Video Studio</span>
        </nav>
        <div className={styles.headerRow}>
          <div>
            <div className={styles.eyebrow}><Sparkles size={14} /> CREATOR VIDEO STUDIO</div>
            <h1>Long-form video, <span>made simple.</span></h1>
            <p className={styles.intro}>A dedicated workspace for creating and managing your long-video campaigns.</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.refreshButton} type="button" onClick={() => void loadUsage(true)} disabled={loading || refreshing}>
              <RefreshCw size={16} className={refreshing ? styles.spinning : ''} />
              Refresh
            </button>
            <Link className={styles.uploadButton} href="/connect-accounts">
              <Upload size={17} /> Start a video post <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      {!loading && !loadError && usage && !isVerified && (
        <section className={styles.verificationBanner} aria-label="Verification required">
          <span className={styles.bannerIcon}><LockKeyhole size={19} /></span>
          <div>
            <h2>Complete creator verification</h2>
            <p>Verify your creator profile to unlock long-video processing and subscription benefits.</p>
          </div>
          <Link href="/profile">Review profile <ArrowRight size={15} /></Link>
        </section>
      )}

      {loadError && (
        <div className={styles.errorBanner} role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadUsage()}>Try again</button>
        </div>
      )}

      {loading ? (
        <div className={styles.skeletonGrid} aria-label="Loading Video Studio" aria-busy="true">
          <div className={`${styles.skeleton} ${styles.skeletonWide}`} />
          <div className={styles.skeleton} />
          <div className={`${styles.skeleton} ${styles.skeletonFull}`} />
        </div>
      ) : usage ? (
        <>
          <section className={styles.overviewGrid} aria-label="Video usage overview">
            <article className={`${styles.card} ${styles.hoursCard}`}>
              <div className={styles.cardHeading}>
                <div><span className={styles.sectionLabel}>SUBSCRIPTION</span><h2>{usage.subscription?.name || 'Your processing hours'}</h2></div>
                <span className={styles.planBadge}>{usage.subscription ? statusLabel(usage.subscription.status || 'active') : 'Free trial'}</span>
              </div>
              {usage.subscription ? (
                <div className={styles.hoursContent}>
                  <div
                    className={styles.hoursMeter}
                    role="img"
                    aria-label={`${formatHours(usage.subscription.hoursUsed)} of ${formatHours(usage.subscription.hoursIncluded)} subscription hours used`}
                    style={{ '--meter-value': `${usage.subscription.hoursIncluded > 0 ? Math.min(100, Math.max(0, usage.subscription.hoursUsed / usage.subscription.hoursIncluded * 100)) : 0}%` } as CSSProperties}
                  >
                    <div className={styles.meterCenter}>
                      <strong>{formatHours(usage.subscription.hoursRemaining)}</strong>
                      <span>hours left</span>
                    </div>
                  </div>
                  <div className={styles.hoursDetails}>
                    <div className={styles.hoursHeadline}><strong>{formatHours(usage.subscription.hoursUsed)}</strong><span> / {formatHours(usage.subscription.hoursIncluded)} hours used</span></div>
                    <p>{usage.subscription.priceRwf != null ? `${formatRwf(usage.subscription.priceRwf)} per month. ` : ''}Included hours reset on your renewal date. Unused hours do not roll over.</p>
                    <div className={styles.renewalRow}><Clock3 size={15} /> Renews {formatDate(usage.subscription.periodEnd)}</div>
                  </div>
                </div>
              ) : (
                <div className={styles.noPlanState}>
                  <strong>No paid plan is active</strong>
                  <p>Your free trial is shown here. Choose a subscription below to get a recurring monthly processing allowance.</p>
                  <a href="#plans-heading">Compare plans <ArrowRight size={14} /></a>
                </div>
              )}
            </article>

            <article className={`${styles.card} ${styles.trialCard}`}>
              <div className={styles.cardHeading}>
                <div><span className={styles.sectionLabel}>WELCOME TRIAL</span><h2>Trial usage</h2></div>
                <span className={styles.trialIcon}><Film size={19} /></span>
              </div>
              <div className={styles.trialNumbers}>
                <strong>{usage.trial.remaining}</strong><span>of {usage.trial.limit} trial videos remaining</span>
              </div>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label="Trial videos used"
                aria-valuemin={0}
                aria-valuemax={usage.trial.limit}
                aria-valuenow={Math.min(usage.trial.limit, usage.trial.used)}
              >
                <span style={{ width: `${trialPercent}%` }} />
              </div>
              <p className={styles.trialNote}>{usage.trial.used} {usage.trial.used === 1 ? 'video' : 'videos'} used. Each trial video can be up to 2 hours.</p>
            </article>
          </section>

          <section className={styles.plansSection} aria-labelledby="plans-heading">
            <div className={styles.sectionHeader}>
              <div><span className={styles.sectionLabel}>FIND YOUR PACE</span><h2 id="plans-heading">Choose your studio plan</h2></div>
              <p>Plans are activated by the Yepper team while online subscription payments are being connected.</p>
            </div>
            <div className={styles.planGrid}>
              {usage.plans.filter((plan) => plan.enabled).map((plan) => {
                const isCurrentPlan = usage.subscription?.plan?.toLowerCase() === plan.code &&
                  ['active', 'trialing', 'approved'].includes((usage.subscription?.status || '').toLowerCase());
                const requestPending = pendingPlanRequests.has(plan.code);
                const busy = requestingPlan === plan.code;
                return (
                  <article key={plan.code} className={`${styles.planCard} ${plan.code === 'creator' ? styles.featuredPlan : ''}`}>
                    {plan.code === 'creator' && <span className={styles.popularTag}>MOST POPULAR</span>}
                    <h3>{plan.name}</h3>
                    <p>{plan.code === 'starter' ? 'A practical allowance for occasional long-form posts.' : plan.code === 'creator' ? 'More room for a consistent publishing schedule.' : 'High-volume processing for established channels.'}</p>
                    <div className={styles.planPrice}><strong>{formatRwf(plan.priceRwf)}</strong><span>/ month</span></div>
                    <div className={styles.planAllowance}>{formatHours(plan.hoursIncluded)} processing hours included</div>
                    <ul className={styles.planBenefits}>
                      <li><Check size={14} /> Long videos up to {usage.limits.maxDurationMinutes} minutes</li>
                      <li><Check size={14} /> Secure review before processing</li>
                      <li><Check size={14} /> Renews monthly, unused hours do not roll over</li>
                    </ul>
                    <button
                      type="button"
                      className={plan.code === 'creator' ? styles.primaryPlanButton : styles.secondaryPlanButton}
                      disabled={Boolean(requestingPlan) || isCurrentPlan || requestPending}
                      onClick={() => void requestPlan(plan.code)}
                    >
                      {busy ? <LoaderCircle size={16} className={styles.spinning} /> : isCurrentPlan || requestPending ? <Check size={16} /> : null}
                      {busy ? 'Sending request' : isCurrentPlan ? 'Current plan' : requestPending ? 'Request received' : 'Request this plan'}
                      {!busy && !isCurrentPlan && !requestPending && <ArrowRight size={15} />}
                    </button>
                  </article>
                );
              })}
            </div>
            <p className={styles.planFootnote}>Extra processing time is RWF {Number(usage.extraHours.priceRwf).toLocaleString()} per hour and is available with an active plan, subject to the monthly processing capacity.</p>
          </section>

          <section className={styles.jobsSection} aria-labelledby="jobs-heading">
            <div className={styles.sectionHeader}>
              <div><span className={styles.sectionLabel}>YOUR WORKSPACE</span><h2 id="jobs-heading">Recent video jobs</h2></div>
              <span className={styles.jobLimit}>Up to {usage.limits.maxDurationMinutes} minutes per video</span>
            </div>
            {usage.jobs.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}><Film size={23} /></span>
                <h3>Your video workspace is ready</h3>
                <p>When you start a long-video post, its progress and status will appear here.</p>
                <Link href="/connect-accounts">Go to creator tools <ArrowRight size={15} /></Link>
              </div>
            ) : (
              <div className={styles.jobsList}>
                {usage.jobs.map((job) => {
                  const displayStatus = getJobStatus(job.status);
                  const isFailed = displayStatus === 'Rejected';
                  const isComplete = displayStatus === 'Ready';
                  const progress = Math.min(100, Math.max(0, Number(job.progress) || 0));
                  return (
                    <article className={styles.jobRow} key={job.id}>
                      <span className={`${styles.jobIcon} ${isFailed ? styles.failedIcon : isComplete ? styles.completeIcon : ''}`}>
                        {isComplete ? <Check size={18} /> : <Film size={18} />}
                      </span>
                      <div className={styles.jobMain}>
                        <div className={styles.jobTitleRow}>
                          <h3>Video job <span>#{String(job.id).slice(-8)}</span></h3>
                          <span className={`${styles.statusBadge} ${isFailed ? styles.failedStatus : isComplete ? styles.completeStatus : ''}`}>{displayStatus}</span>
                        </div>
                        <p>{job.stage_message || (isFailed ? job.error_message : 'Your job status will update here.') || 'Your job status will update here.'}</p>
                        <ol className={styles.jobTimeline} aria-label={`Job timeline. Current status: ${displayStatus}`}>
                          {JOB_TIMELINE_STEPS.map((step, index) => {
                            const stepState = getTimelineState(index, displayStatus);
                            return (
                              <li className={`${styles.timelineStep} ${styles[`timeline_${stepState}`]}`} key={step}>
                                <span className={styles.timelineMarker} aria-hidden="true">{stepState === 'complete' ? <Check size={11} /> : null}</span>
                                <span>{stepState === 'rejected' ? 'Rejected' : step}</span>
                              </li>
                            );
                          })}
                        </ol>
                        {!isComplete && !isFailed && (
                          <div className={styles.jobProgress} role="progressbar" aria-label={`Job progress: ${progress}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                            <span style={{ width: `${progress}%` }} />
                          </div>
                        )}
                        {isFailed && job.error_code && <span className={styles.errorCode}>Reference: {job.error_code}</span>}
                      </div>
                      <div className={styles.jobMeta}>
                        <span>{formatDate(job.created_at)}</span>
                        {job.duration_seconds != null && <span>{Math.floor(job.duration_seconds / 60)}:{String(job.duration_seconds % 60).padStart(2, '0')} video</span>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <div className={styles.uploadNote}>
            <BadgeCheck size={17} />
            <p><strong>Ready to make a post?</strong> Start from your existing Post ad flow after connecting your account. Video Studio will show your job status here.</p>
            <Link href="/connect-accounts" aria-label="Open connected accounts"><ArrowRight size={17} /></Link>
          </div>
        </>
      ) : null}

      <div className={styles.footer}><span><LockKeyhole size={13} /> Your creator workspace</span><span>Need help? Contact creator support from your dashboard.</span></div>
      <div className={`${styles.toast} ${toast ? styles.toastVisible : ''}`} role="status" aria-live="polite">
        <Check size={17} /> <span>{toast}</span>
      </div>
    </div>
  );
}
