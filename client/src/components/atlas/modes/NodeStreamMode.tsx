import { useState, useCallback } from 'react';
import { MotionDiv } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { Video, ArrowLeft, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Feed from '@/components/nodestream/Feed';
import Recorder from '@/components/nodestream/Recorder';
import Player from '@/components/nodestream/Player';
import type { DID } from '@shared/nodestream-types';

type NodeStreamView = 'feed' | 'recorder' | 'player' | 'bookmarks' | 'profile';

interface ProfileViewProps {
  did: DID;
  onBack: () => void;
}

function ProfileView({ did, onBack }: ProfileViewProps) {
  return (
    <div className="h-full flex flex-col" data-testid="nodestream-profile">
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          data-testid="button-profile-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-bold text-white">Creator Profile</h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
        <img
          src={`https://api.dicebear.com/7.x/identicon/svg?seed=${did}`}
          alt="Profile"
          className="w-24 h-24 rounded-full bg-slate-700 mb-4"
          data-testid="img-profile-avatar"
        />
        <p className="text-white font-medium mb-1" data-testid="text-profile-did">
          {did.slice(0, 20)}...
        </p>
        <p className="text-sm text-slate-400">Creator on NodeStream</p>
      </div>
    </div>
  );
}

function BookmarksView({ onBack }: { onBack: () => void; onPlay?: (streamId: string) => void }) {
  return (
    <div className="h-full flex flex-col" data-testid="nodestream-bookmarks">
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          data-testid="button-bookmarks-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-blue-400" />
          Bookmarks
        </h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
        <Bookmark className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">Your bookmarked streams will appear here</p>
      </div>
    </div>
  );
}

export default function NodeStreamMode() {
  const { pushReceipt } = useAtlasStore();
  const [view, setView] = useState<NodeStreamView>('feed');
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [currentProfileDid, setCurrentProfileDid] = useState<DID | null>(null);

  const handlePlay = useCallback((streamId: string) => {
    setCurrentStreamId(streamId);
    setView('player');
    pushReceipt({
      id: `receipt-nodestream-play-${Date.now()}`,
      hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
      scope: 'atlas.render.nodestream.play',
      endpoint: `/api/atlas/streaming/v2/nodestream/streams/${streamId}`,
      timestamp: Date.now()
    });
  }, [pushReceipt]);

  const handleRecord = useCallback(() => {
    setView('recorder');
  }, []);

  const handleProfile = useCallback((did: DID) => {
    setCurrentProfileDid(did);
    setView('profile');
  }, []);

  const handleBack = useCallback(() => {
    setView('feed');
    setCurrentStreamId(null);
    setCurrentProfileDid(null);
  }, []);

  const handlePublished = useCallback(() => {
    setView('feed');
    pushReceipt({
      id: `receipt-nodestream-publish-${Date.now()}`,
      hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
      scope: 'atlas.render.nodestream.publish',
      endpoint: '/api/atlas/streaming/v2/nodestream/streams',
      timestamp: Date.now()
    });
  }, [pushReceipt]);

  const handleBookmarks = useCallback(() => {
    setView('bookmarks');
  }, []);

  const renderView = () => {
    switch (view) {
      case 'feed':
        return (
          <Feed
            onPlay={handlePlay}
            onRecord={handleRecord}
            onProfile={handleProfile}
          />
        );
      case 'recorder':
        return (
          <Recorder
            onPublished={handlePublished}
            onCancel={handleBack}
          />
        );
      case 'player':
        if (!currentStreamId) {
          return null;
        }
        return (
          <Player
            streamId={currentStreamId}
            onBack={handleBack}
            onProfile={handleProfile}
          />
        );
      case 'bookmarks':
        return (
          <BookmarksView
            onBack={handleBack}
            onPlay={handlePlay}
          />
        );
      case 'profile':
        if (!currentProfileDid) {
          return null;
        }
        return (
          <ProfileView
            did={currentProfileDid}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <MotionDiv
      className="h-full flex flex-col relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      data-testid="nodestream-mode"
    >
      <div className="flex-shrink-0 p-4 border-b border-white/10 bg-gradient-to-b from-slate-900/50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Video className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white" data-testid="text-nodestream-title">
                NodeStream
              </h2>
              <p className="text-xs text-white/40">
                Decentralized video streaming
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBookmarks}
              className={`text-white/60 hover:text-white ${view === 'bookmarks' ? 'bg-white/10' : ''}`}
              data-testid="button-nodestream-bookmarks"
            >
              <Bookmark className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {renderView()}
      </div>
    </MotionDiv>
  );
}
