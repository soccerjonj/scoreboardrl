import { useState } from "react";
import { Trophy, ChevronRight, X as XIcon, Check, Loader2 } from "lucide-react";
import { useTournamentSession, ROUND_LABELS, TOURNAMENT_TYPE_LABELS } from "@/hooks/useTournamentSession";
import TournamentModeSheet from "./TournamentModeSheet";

/**
 * Persistent global banner shown at the top of every page.
 * Two variants:
 *   - Pending invite(s): friend has invited me, show Join / Decline
 *   - Active tournament: I've joined, pulsing banner that opens Tournament Mode
 * Active state takes precedence if I'm in both states at once.
 */
export default function TournamentLiveBanner() {
  const {
    activeTournament,
    isActive,
    currentRound,
    pendingInvites,
    acceptInvite,
    declineInvite,
  } = useTournamentSession();
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Active joined tournament — show pulsing yellow banner
  if (isActive && activeTournament) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-3 px-4 py-2 border-b border-yellow-400/30 bg-gradient-to-r from-yellow-400/15 via-yellow-400/8 to-yellow-400/15 hover:from-yellow-400/20 hover:via-yellow-400/12 hover:to-yellow-400/20 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-4 h-4 text-yellow-400 shrink-0 animate-pulse" />
            <span className="text-xs font-semibold text-yellow-300 truncate">
              Tournament Active
            </span>
            <span className="text-xs text-yellow-400/70 truncate">
              · {activeTournament.game_mode} {TOURNAMENT_TYPE_LABELS[activeTournament.tournament_type as keyof typeof TOURNAMENT_TYPE_LABELS] ?? activeTournament.tournament_type}
              {currentRound && ` · ${ROUND_LABELS[currentRound]}`}
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-yellow-300 shrink-0">
            Open <ChevronRight className="w-3 h-3" />
          </span>
        </button>
        <TournamentModeSheet open={open} onOpenChange={setOpen} />
      </>
    );
  }

  // Pending invite — show invite banner with Join / Decline. Show first invite
  // if multiple are pending; the rest will surface as user resolves each.
  if (pendingInvites.length > 0) {
    const invite = pendingInvites[0];
    const typeLabel = TOURNAMENT_TYPE_LABELS[invite.tournament_type as keyof typeof TOURNAMENT_TYPE_LABELS] ?? invite.tournament_type;
    const isAccepting = pendingAction === `accept-${invite.tournament_id}`;
    const isDeclining = pendingAction === `decline-${invite.tournament_id}`;
    const busy = isAccepting || isDeclining;

    return (
      <div className="w-full flex items-center justify-between gap-2 px-4 py-2 border-b border-primary/30 bg-gradient-to-r from-primary/15 via-primary/8 to-primary/15">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate">
            {invite.inviter_name ?? "A friend"}
          </span>
          <span className="text-xs text-muted-foreground truncate hidden xs:inline">
            invited you · {invite.game_mode} {typeLabel}
          </span>
          <span className="text-xs text-muted-foreground truncate xs:hidden">
            · {invite.game_mode} {typeLabel}
          </span>
          {pendingInvites.length > 1 && (
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
              +{pendingInvites.length - 1} more
            </span>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={async () => {
              setPendingAction(`decline-${invite.tournament_id}`);
              await declineInvite(invite.tournament_id);
              setPendingAction(null);
            }}
            disabled={busy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-muted-foreground hover:text-rl-red hover:bg-rl-red/10 transition-colors disabled:opacity-50"
          >
            {isDeclining ? <Loader2 className="w-3 h-3 animate-spin" /> : <XIcon className="w-3 h-3" />}
            <span className="hidden sm:inline">Decline</span>
          </button>
          <button
            onClick={async () => {
              setPendingAction(`accept-${invite.tournament_id}`);
              await acceptInvite(invite.tournament_id);
              setPendingAction(null);
            }}
            disabled={busy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isAccepting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Join
          </button>
        </div>
      </div>
    );
  }

  return null;
}
