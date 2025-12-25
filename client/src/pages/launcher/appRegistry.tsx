import { ReactNode, ComponentType } from 'react';
import { 
  Shield, Key, Clock, Award, RefreshCw, FileCheck, CheckCircle,
  CreditCard, Store, Gift, Gauge,
  Palette, PenTool, Music, Headphones, Image as ImageIcon, Video,
  BookOpen, Link, Bell, Zap, Map,
  Vote, Users, HelpCircle,
  BarChart3, Receipt,
  Lock, Repeat, FileSignature, Send,
  MessageSquare, UserCheck, Phone, FileText, Table,
  Gamepad2, Target, Puzzle, Coins, Timer, Car, Building, Grid3X3,
  TrendingUp,
  ShieldCheck,
  Globe
} from 'lucide-react';

import IdentityVaultTile from "@/components/tiles/IdentityVaultTile";
import PresenceTile from "@/components/tiles/PresenceTile";
import InvoiceTile from "@/components/tiles/InvoiceTile";
import SketchpadTile from "@/components/tiles/SketchpadTile";
import LoopTile from "@/components/tiles/LoopTile";
import StoryTile from "@/components/tiles/StoryTile";
import TriviaTile from "@/components/tiles/TriviaTile";
import MarketplaceTile from "@/components/tiles/MarketplaceTile";
import VoteTile from "@/components/tiles/VoteTile";
import AnalyticsTile from "@/components/tiles/AnalyticsTile";
import ReceiptsTile from "@/components/tiles/ReceiptsTile";
import LinkTile from "@/components/tiles/LinkTile";
import ReminderTile from "@/components/tiles/ReminderTile";
import RewardTile from "@/components/tiles/RewardTile";
import ProofReadTile from "@/components/tiles/ProofReadTile";
import SessionResumeTile from "@/components/tiles/SessionResumeTile";
import KeyRotationTile from "@/components/tiles/KeyRotationTile";
import MemeMintTile from "@/components/tiles/MemeMintTile";
import WhiteboardTile from "@/components/tiles/WhiteboardTile";
import MusicJamTile from "@/components/tiles/MusicJamTile";
import PolicyAckTile from "@/components/tiles/PolicyAckTile";
import MicroDaoTile from "@/components/tiles/MicroDaoTile";
import QuotaTile from "@/components/tiles/QuotaTile";
import ReactionRaceTile from "@/components/tiles/ReactionRaceTile";
import TreasureHuntTile from "@/components/tiles/TreasureHuntTile";
import BadgeCollectorTile from "@/components/tiles/BadgeCollectorTile";
import VideoFeedTile from "@/components/tiles/VideoFeedTile";
import CryptoTrackerTile from "@/components/tiles/CryptoTrackerTile";
import EncryptedGalleryTile from "@/components/tiles/EncryptedGalleryTile";
import { MessagingTile, VideoCallsTile, VoiceCallsTile, NotesTile, PaymentsTile } from "@/components/tiles/NexusLinkTile";

import GameAsteroidTile from "@/components/games/GameAsteroidTile";
import GameBreakoutTile from "@/components/games/GameBreakoutTile";
import GameMazeTile from "@/components/games/GameMazeTile";
import GameCoinTile from "@/components/games/GameCoinTile";
import GameReactionTile from "@/components/games/GameReactionTile";
import GameRacerTile from "@/components/games/GameRacerTile";
import GameTowerTile from "@/components/games/GameTowerTile";
import GameGravityGridTile from "@/components/games/GameBlockDropTile";

import GatedAccessTile from "@/tiles/GatedAccessTile";
import CrossDeviceResumeTile from "@/tiles/CrossDeviceResumeTile";
import MicroFeedTile from "@/tiles/MicroFeedTile";
import ProCardTile from "@/tiles/ProCardTile";
import ProofOfNotaryTile from "@/tiles/ProofOfNotaryTile";
import AnonymousSendTile from "@/tiles/AnonymousSendTile";
import AtlasTile from "@/components/tiles/AtlasTile";
import ContactAtlasTile from "@/components/tiles/ContactAtlasTile";
import WriterTile from "@/components/tiles/WriterTile";
import CalcTile from "@/components/tiles/CalcTile";
import XboxGamingTile from "@/components/tiles/XboxGamingTile";

function ModPanelTile() {
  return (
    <div className="p-4 text-center">
      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
        <span className="text-3xl">🛡️</span>
      </div>
      <h3 className="font-medium text-white mb-2">Moderator Panel</h3>
      <p className="text-sm text-slate-400 mb-4">Wallet-gated moderation dashboard for the Hub.</p>
      <a 
        href="/mod/" 
        className="inline-block px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        data-testid="link-open-mod-panel"
      >
        Open Panel
      </a>
    </div>
  );
}

export interface EmbedHandler {
  onEmbed?: (name: string, url: string, icon: string) => void;
}

export interface AppDefinition {
  id: string;
  name: string;
  icon: ReactNode;
  gradient: string;
  category: 'communication' | 'security' | 'payments' | 'creative' | 'social' | 'governance' | 'analytics' | 'developer' | 'games' | 'external';
  component: ComponentType<EmbedHandler>;
  anchorEvents?: string[];
  gatedRole?: 'moderator';
}

export const anchorEventsMap: Record<string, string[]> = {
  'identity-vault': ['identity_created', 'identity_verified', 'identity_updated'],
  'key-rotation': ['key_rotated', 'key_generated', 'key_revoked'],
  'presence': ['presence_verified', 'check_in', 'check_out'],
  'badges': ['badge_earned', 'badge_claimed', 'badge_verified'],
  'session-resume': ['session_started', 'session_resumed', 'session_ended'],
  'policy-ack': ['policy_acknowledged', 'consent_given', 'terms_accepted'],
  'proof-read': ['proof_verified', 'document_read', 'attestation_created'],
  'invoice': ['invoice_created', 'payment_received', 'invoice_settled'],
  'marketplace': ['listing_created', 'purchase_made', 'item_sold'],
  'rewards': ['reward_earned', 'reward_claimed', 'points_redeemed'],
  'quota': ['quota_checked', 'quota_updated', 'limit_reached'],
  'sketchpad': ['sketch_saved', 'sketch_shared', 'canvas_exported'],
  'whiteboard': ['board_saved', 'collaboration_started', 'drawing_completed'],
  'loop': ['loop_recorded', 'loop_shared', 'audio_exported'],
  'music-jam': ['jam_started', 'track_added', 'session_recorded'],
  'meme-mint': ['meme_created', 'meme_minted', 'nft_transferred'],
  'video-feed': ['video_uploaded', 'video_viewed', 'engagement_recorded'],
  'story': ['story_posted', 'story_viewed', 'reaction_added'],
  'link': ['link_shared', 'link_clicked', 'bookmark_saved'],
  'reminder': ['reminder_set', 'reminder_triggered', 'task_completed'],
  'reaction-race': ['race_started', 'reaction_recorded', 'winner_declared'],
  'treasure-hunt': ['hunt_started', 'clue_found', 'treasure_claimed'],
  'vote': ['vote_cast', 'proposal_created', 'result_finalized'],
  'micro-dao': ['dao_created', 'member_joined', 'proposal_passed'],
  'trivia': ['quiz_started', 'answer_submitted', 'score_recorded'],
  'analytics': ['metric_recorded', 'report_generated', 'dashboard_viewed'],
  'receipts': ['receipt_created', 'receipt_verified', 'receipt_anchored'],
  'gated-access': ['access_granted', 'access_denied', 'gate_configured'],
  'cross-device': ['device_linked', 'session_synced', 'handoff_completed'],
  'notary': ['document_notarized', 'signature_verified', 'timestamp_recorded'],
  'anon-send': ['message_sent', 'message_received', 'privacy_verified'],
  'micro-feed': ['post_created', 'feed_updated', 'interaction_recorded'],
  'pro-card': ['card_created', 'card_verified', 'credential_shared'],
  'game-asteroid': ['game_start', 'game_over', 'high_score', 'level_complete'],
  'game-breakout': ['game_start', 'game_over', 'high_score', 'level_complete'],
  'game-maze': ['game_start', 'game_over', 'maze_solved', 'best_time'],
  'game-coin': ['game_start', 'game_over', 'coins_collected', 'high_score'],
  'game-reaction': ['game_start', 'game_over', 'reaction_time', 'new_record'],
  'game-racer': ['game_start', 'game_over', 'high_score', 'lap_complete'],
  'game-tower': ['game_start', 'game_over', 'tower_height', 'high_score'],
  'game-gravity-grid': ['game_start', 'game_over', 'lines_cleared', 'high_score'],
  'crypto-tracker': ['token_added', 'token_removed', 'prices_refreshed', 'price_alert'],
  'encrypted-gallery': ['image_uploaded', 'image_anchored', 'gallery_unlocked', 'image_deleted'],
  'mod-panel': ['report_reviewed', 'user_moderated', 'action_taken'],
  'nexus-messaging': ['message_sent', 'message_received', 'thread_created'],
  'nexus-video': ['call_started', 'call_ended', 'call_anchored'],
  'nexus-voice': ['call_started', 'call_ended', 'call_anchored'],
  'nexus-notes': ['note_created', 'note_updated', 'note_anchored'],
  'nexus-payments': ['payment_sent', 'payment_received', 'payment_anchored'],
  'writer': ['doc_created', 'doc_updated', 'doc_anchored'],
  'calc': ['sheet_created', 'sheet_updated', 'sheet_anchored'],
};

export const appRegistry: AppDefinition[] = [
  // Communication
  { id: 'atlas', name: 'Atlas', icon: <Globe className="w-full h-full" />, gradient: 'from-violet-500 to-purple-600', category: 'communication', component: AtlasTile },
  { id: 'contact-atlas', name: 'Contact Us', icon: <MessageSquare className="w-full h-full" />, gradient: 'from-cyan-500 to-blue-600', category: 'communication', component: ContactAtlasTile },
  { id: 'nexus-messaging', name: 'Messages', icon: <MessageSquare className="w-full h-full" />, gradient: 'from-purple-500 to-indigo-600', category: 'communication', component: MessagingTile },
  { id: 'nexus-video', name: 'Video', icon: <Video className="w-full h-full" />, gradient: 'from-indigo-500 to-blue-600', category: 'communication', component: VideoCallsTile },
  { id: 'nexus-voice', name: 'Voice', icon: <Phone className="w-full h-full" />, gradient: 'from-green-500 to-emerald-600', category: 'communication', component: VoiceCallsTile },

  // Security & Identity
  { id: 'identity-vault', name: 'Identity Vault', icon: <Shield className="w-full h-full" />, gradient: 'from-violet-500 to-purple-600', category: 'security', component: IdentityVaultTile },
  { id: 'key-rotation', name: 'Key Rotation', icon: <Key className="w-full h-full" />, gradient: 'from-violet-500 to-indigo-600', category: 'security', component: KeyRotationTile },
  { id: 'presence', name: 'Presence', icon: <Clock className="w-full h-full" />, gradient: 'from-purple-500 to-pink-600', category: 'security', component: PresenceTile },
  { id: 'badges', name: 'Badges', icon: <Award className="w-full h-full" />, gradient: 'from-amber-500 to-orange-600', category: 'security', component: BadgeCollectorTile },
  { id: 'session-resume', name: 'Session', icon: <RefreshCw className="w-full h-full" />, gradient: 'from-blue-500 to-cyan-600', category: 'security', component: SessionResumeTile },
  { id: 'policy-ack', name: 'Policy', icon: <FileCheck className="w-full h-full" />, gradient: 'from-slate-500 to-gray-600', category: 'security', component: PolicyAckTile },
  { id: 'proof-read', name: 'Proof Read', icon: <CheckCircle className="w-full h-full" />, gradient: 'from-green-500 to-emerald-600', category: 'security', component: ProofReadTile },
  { id: 'encrypted-gallery', name: 'Photos', icon: <ImageIcon className="w-full h-full" />, gradient: 'from-pink-500 to-rose-600', category: 'security', component: EncryptedGalleryTile },

  // Payments & Commerce
  { id: 'nexus-payments', name: 'Send', icon: <CreditCard className="w-full h-full" />, gradient: 'from-cyan-500 to-blue-600', category: 'payments', component: PaymentsTile },
  { id: 'invoice', name: 'Invoice', icon: <CreditCard className="w-full h-full" />, gradient: 'from-amber-500 to-yellow-600', category: 'payments', component: InvoiceTile },
  { id: 'marketplace', name: 'Market', icon: <Store className="w-full h-full" />, gradient: 'from-orange-500 to-red-600', category: 'payments', component: MarketplaceTile },
  { id: 'rewards', name: 'Rewards', icon: <Gift className="w-full h-full" />, gradient: 'from-pink-500 to-rose-600', category: 'payments', component: RewardTile },
  { id: 'quota', name: 'Quota', icon: <Gauge className="w-full h-full" />, gradient: 'from-teal-500 to-cyan-600', category: 'payments', component: QuotaTile },

  // Creative & Media
  { id: 'nexus-notes', name: 'Notes', icon: <FileText className="w-full h-full" />, gradient: 'from-amber-500 to-orange-600', category: 'creative', component: NotesTile },
  { id: 'sketchpad', name: 'Sketchpad', icon: <Palette className="w-full h-full" />, gradient: 'from-pink-500 to-rose-600', category: 'creative', component: SketchpadTile },
  { id: 'whiteboard', name: 'Whiteboard', icon: <PenTool className="w-full h-full" />, gradient: 'from-sky-500 to-blue-600', category: 'creative', component: WhiteboardTile },
  { id: 'loop', name: 'Loop Audio', icon: <Music className="w-full h-full" />, gradient: 'from-purple-500 to-violet-600', category: 'creative', component: LoopTile },
  { id: 'music-jam', name: 'Music Jam', icon: <Headphones className="w-full h-full" />, gradient: 'from-indigo-500 to-purple-600', category: 'creative', component: MusicJamTile },
  { id: 'meme-mint', name: 'Meme Mint', icon: <ImageIcon className="w-full h-full" />, gradient: 'from-yellow-500 to-orange-600', category: 'creative', component: MemeMintTile },
  { id: 'video-feed', name: 'Video', icon: <Video className="w-full h-full" />, gradient: 'from-red-500 to-pink-600', category: 'creative', component: VideoFeedTile },
  { id: 'writer', name: 'Writer', icon: <FileText className="w-full h-full" />, gradient: 'from-blue-500 to-indigo-600', category: 'creative', component: WriterTile },
  { id: 'calc', name: 'Calc', icon: <Table className="w-full h-full" />, gradient: 'from-green-500 to-emerald-600', category: 'creative', component: CalcTile },

  // Social & Collaboration
  { id: 'story', name: 'Stories', icon: <BookOpen className="w-full h-full" />, gradient: 'from-blue-500 to-indigo-600', category: 'social', component: StoryTile },
  { id: 'link', name: 'Links', icon: <Link className="w-full h-full" />, gradient: 'from-cyan-500 to-teal-600', category: 'social', component: LinkTile },
  { id: 'reminder', name: 'Reminders', icon: <Bell className="w-full h-full" />, gradient: 'from-amber-500 to-orange-600', category: 'social', component: ReminderTile },
  { id: 'reaction-race', name: 'React Race', icon: <Zap className="w-full h-full" />, gradient: 'from-yellow-500 to-amber-600', category: 'social', component: ReactionRaceTile },
  { id: 'treasure-hunt', name: 'Treasure', icon: <Map className="w-full h-full" />, gradient: 'from-emerald-500 to-green-600', category: 'social', component: TreasureHuntTile },

  // Governance & Voting
  { id: 'vote', name: 'Vote', icon: <Vote className="w-full h-full" />, gradient: 'from-cyan-500 to-blue-600', category: 'governance', component: VoteTile },
  { id: 'micro-dao', name: 'Micro DAO', icon: <Users className="w-full h-full" />, gradient: 'from-indigo-500 to-purple-600', category: 'governance', component: MicroDaoTile },
  { id: 'trivia', name: 'Trivia', icon: <HelpCircle className="w-full h-full" />, gradient: 'from-fuchsia-500 to-pink-600', category: 'governance', component: TriviaTile },

  // Analytics & Data
  { id: 'analytics', name: 'Analytics', icon: <BarChart3 className="w-full h-full" />, gradient: 'from-indigo-500 to-blue-600', category: 'analytics', component: AnalyticsTile },
  { id: 'receipts', name: 'Receipts', icon: <Receipt className="w-full h-full" />, gradient: 'from-emerald-500 to-teal-600', category: 'analytics', component: ReceiptsTile },

  // Developer & Security
  { id: 'gated-access', name: 'Gated', icon: <Lock className="w-full h-full" />, gradient: 'from-sky-500 to-cyan-600', category: 'developer', component: GatedAccessTile },
  { id: 'cross-device', name: 'Cross-Dev', icon: <Repeat className="w-full h-full" />, gradient: 'from-teal-500 to-emerald-600', category: 'developer', component: CrossDeviceResumeTile },
  { id: 'notary', name: 'Notary', icon: <FileSignature className="w-full h-full" />, gradient: 'from-amber-500 to-yellow-600', category: 'developer', component: ProofOfNotaryTile },
  { id: 'anon-send', name: 'Anon Send', icon: <Send className="w-full h-full" />, gradient: 'from-slate-500 to-zinc-600', category: 'developer', component: AnonymousSendTile },
  { id: 'micro-feed', name: 'MicroFeed', icon: <MessageSquare className="w-full h-full" />, gradient: 'from-blue-500 to-indigo-600', category: 'developer', component: MicroFeedTile },
  { id: 'pro-card', name: 'ProCard', icon: <UserCheck className="w-full h-full" />, gradient: 'from-violet-500 to-purple-600', category: 'developer', component: ProCardTile },
  { id: 'crypto-tracker', name: 'Crypto', icon: <TrendingUp className="w-full h-full" />, gradient: 'from-emerald-500 to-cyan-600', category: 'developer', component: CryptoTrackerTile },

  // Games
  { id: 'game-asteroid', name: 'Asteroids', icon: <Target className="w-full h-full" />, gradient: 'from-emerald-500 to-green-600', category: 'games', component: GameAsteroidTile },
  { id: 'game-breakout', name: 'Breakout', icon: <Puzzle className="w-full h-full" />, gradient: 'from-blue-500 to-cyan-600', category: 'games', component: GameBreakoutTile },
  { id: 'game-maze', name: 'Maze', icon: <Grid3X3 className="w-full h-full" />, gradient: 'from-purple-500 to-pink-600', category: 'games', component: GameMazeTile },
  { id: 'game-coin', name: 'Coin Drop', icon: <Coins className="w-full h-full" />, gradient: 'from-amber-500 to-yellow-600', category: 'games', component: GameCoinTile },
  { id: 'game-reaction', name: 'Reaction', icon: <Timer className="w-full h-full" />, gradient: 'from-red-500 to-orange-600', category: 'games', component: GameReactionTile },
  { id: 'game-racer', name: 'Racer', icon: <Car className="w-full h-full" />, gradient: 'from-sky-500 to-blue-600', category: 'games', component: GameRacerTile },
  { id: 'game-tower', name: 'Tower', icon: <Building className="w-full h-full" />, gradient: 'from-slate-500 to-gray-600', category: 'games', component: GameTowerTile },
  { id: 'game-gravity-grid', name: 'Gravity Grid', icon: <Gamepad2 className="w-full h-full" />, gradient: 'from-indigo-500 to-violet-600', category: 'games', component: GameGravityGridTile },
  { id: 'xbox-cloud', name: 'Xbox Cloud', icon: <Gamepad2 className="w-full h-full" />, gradient: 'from-green-500 to-emerald-600', category: 'games', component: XboxGamingTile },

  // Moderator (gated)
  { id: 'mod-panel', name: 'Mod Panel', icon: <ShieldCheck className="w-full h-full" />, gradient: 'from-emerald-500 to-teal-600', category: 'governance', component: ModPanelTile, gatedRole: 'moderator' },
];

export const categoryInfo = {
  all: { name: 'All Apps', gradient: 'from-slate-500 to-slate-600', tagline: 'Browse all available apps.' },
  communication: { name: 'Communication', gradient: 'from-cyan-500 to-blue-600', tagline: 'Encrypted messaging, voice, and video.' },
  security: { name: 'Security', gradient: 'from-violet-500 to-purple-600', tagline: 'Zero-PII tools for anchored trust.' },
  payments: { name: 'Payments', gradient: 'from-amber-500 to-orange-600', tagline: 'Auditable commerce, on-chain receipts.' },
  creative: { name: 'Creative', gradient: 'from-pink-500 to-rose-600', tagline: 'Anchor your creative moments.' },
  social: { name: 'Social', gradient: 'from-blue-500 to-indigo-600', tagline: 'Verified connections, proven engagement.' },
  governance: { name: 'Governance', gradient: 'from-cyan-500 to-teal-600', tagline: 'Transparent decisions, immutable records.' },
  analytics: { name: 'Analytics', gradient: 'from-indigo-500 to-blue-600', tagline: 'Data insights with proof trails.' },
  developer: { name: 'Developer', gradient: 'from-sky-500 to-cyan-600', tagline: 'Protocol primitives for builders.' },
  games: { name: 'Games', gradient: 'from-emerald-500 to-green-600', tagline: 'Play-to-prove with blockchain anchoring.' },
  external: { name: 'Web Apps', gradient: 'from-slate-600 to-zinc-700', tagline: 'Connect to popular web services.' },
};

function createExternalAppTile(name: string, url: string, icon: string) {
  return function ExternalTile({ onEmbed }: { onEmbed?: (name: string, url: string, icon: string) => void }) {
    const handleLaunch = () => {
      if (onEmbed) {
        onEmbed(name, url, icon);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };

    return (
      <div className="p-4 text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-slate-600 to-zinc-700 flex items-center justify-center shadow-lg">
          <span className="text-3xl">{icon}</span>
        </div>
        <h3 className="font-medium text-white mb-2">{name}</h3>
        <p className="text-sm text-slate-400 mb-4">Runs in P3 Launcher</p>
        <button 
          onClick={handleLaunch}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-medium transition-colors"
          data-testid={`button-launch-${name.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <span>Launch {name}</span>
          <span className="text-[10px] opacity-70">→</span>
        </button>
      </div>
    );
  };
}

const ExternalIcon = ({ emoji }: { emoji: string }) => <span className="text-2xl">{emoji}</span>;

export const externalApps: AppDefinition[] = [
  { id: 'dehub', name: 'DeHub', icon: <ExternalIcon emoji="🌐" />, gradient: 'from-violet-500 to-purple-600', category: 'external', component: createExternalAppTile('DeHub', 'https://dehub.io', '🌐') },
  { id: 'gmail', name: 'Gmail', icon: <ExternalIcon emoji="📧" />, gradient: 'from-red-500 to-red-600', category: 'external', component: createExternalAppTile('Gmail', 'https://mail.google.com', '📧') },
  { id: 'slack', name: 'Slack', icon: <ExternalIcon emoji="💼" />, gradient: 'from-purple-500 to-purple-600', category: 'external', component: createExternalAppTile('Slack', 'https://slack.com', '💼') },
  { id: 'discord', name: 'Discord', icon: <ExternalIcon emoji="🎮" />, gradient: 'from-indigo-600 to-purple-600', category: 'external', component: createExternalAppTile('Discord', 'https://discord.com', '🎮') },
  { id: 'notion', name: 'Notion', icon: <ExternalIcon emoji="📓" />, gradient: 'from-slate-600 to-slate-700', category: 'external', component: createExternalAppTile('Notion', 'https://notion.so', '📓') },
  { id: 'figma', name: 'Figma', icon: <ExternalIcon emoji="🎨" />, gradient: 'from-purple-500 to-pink-500', category: 'external', component: createExternalAppTile('Figma', 'https://figma.com', '🎨') },
  { id: 'spotify', name: 'Spotify', icon: <ExternalIcon emoji="🎵" />, gradient: 'from-green-500 to-green-600', category: 'external', component: createExternalAppTile('Spotify', 'https://open.spotify.com', '🎵') },
  { id: 'youtube', name: 'YouTube', icon: <ExternalIcon emoji="▶️" />, gradient: 'from-red-500 to-red-600', category: 'external', component: createExternalAppTile('YouTube', 'https://youtube.com', '▶️') },
  { id: 'twitter', name: 'X (Twitter)', icon: <ExternalIcon emoji="🐦" />, gradient: 'from-slate-700 to-slate-800', category: 'external', component: createExternalAppTile('X', 'https://x.com', '🐦') },
  { id: 'github', name: 'GitHub', icon: <ExternalIcon emoji="🐙" />, gradient: 'from-slate-700 to-slate-800', category: 'external', component: createExternalAppTile('GitHub', 'https://github.com', '🐙') },
  { id: 'linkedin', name: 'LinkedIn', icon: <ExternalIcon emoji="💼" />, gradient: 'from-blue-600 to-blue-700', category: 'external', component: createExternalAppTile('LinkedIn', 'https://linkedin.com', '💼') },
  { id: 'coinbase', name: 'Coinbase', icon: <ExternalIcon emoji="🪙" />, gradient: 'from-blue-500 to-blue-600', category: 'external', component: createExternalAppTile('Coinbase', 'https://coinbase.com', '🪙') },
  { id: 'opensea', name: 'OpenSea', icon: <ExternalIcon emoji="🌊" />, gradient: 'from-blue-500 to-blue-600', category: 'external', component: createExternalAppTile('OpenSea', 'https://opensea.io', '🌊') },
  { id: 'google-drive', name: 'Drive', icon: <ExternalIcon emoji="📁" />, gradient: 'from-yellow-500 to-yellow-600', category: 'external', component: createExternalAppTile('Google Drive', 'https://drive.google.com', '📁') },
  { id: 'dropbox', name: 'Dropbox', icon: <ExternalIcon emoji="📦" />, gradient: 'from-blue-500 to-blue-600', category: 'external', component: createExternalAppTile('Dropbox', 'https://dropbox.com', '📦') },
  { id: 'trello', name: 'Trello', icon: <ExternalIcon emoji="📋" />, gradient: 'from-blue-500 to-blue-600', category: 'external', component: createExternalAppTile('Trello', 'https://trello.com', '📋') },
  { id: 'canva', name: 'Canva', icon: <ExternalIcon emoji="🖼️" />, gradient: 'from-cyan-500 to-blue-500', category: 'external', component: createExternalAppTile('Canva', 'https://canva.com', '🖼️') },
];

export const allApps: AppDefinition[] = [...appRegistry, ...externalApps];
