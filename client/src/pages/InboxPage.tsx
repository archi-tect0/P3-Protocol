import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Inbox, Star, Archive, Trash2, Mail, MailOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Message {
  id: string;
  fromWallet: string;
  toWallet: string;
  encryptedContent: string;
  contentHash: string;
  status: string;
  createdAt: string;
}

interface InboxItem {
  id: string;
  walletAddress: string;
  messageId: string;
  status: string;
  isStarred: number;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  message?: Message;
}

export default function InboxPage() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('unread');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<InboxItem | null>(null);

  const { data: inboxItems = [], isLoading } = useQuery<InboxItem[]>({
    queryKey: ['/api/inbox', selectedTab],
    queryFn: async () => {
      const params = selectedTab !== 'all' ? `?status=${selectedTab}` : '';
      return apiRequest(`/api/inbox${params}`);
    },
  });

  const bulkAction = useMutation({
    mutationFn: async (data: { ids: string[]; action: string }) => {
      return apiRequest('/api/inbox/bulk', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inbox'] });
      setSelectedItems(new Set());
      toast({
        title: 'Action completed',
        description: 'Bulk action completed successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: error.message,
      });
    },
  });

  const toggleItemSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    if (selectedItems.size === inboxItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(inboxItems.map(item => item.id)));
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedItems.size === 0) {
      toast({
        variant: 'destructive',
        title: 'No items selected',
        description: 'Please select at least one item.',
      });
      return;
    }

    bulkAction.mutate({
      ids: Array.from(selectedItems),
      action,
    });
  };

  const decryptMessage = (encryptedContent: string): string => {
    try {
      return atob(encryptedContent);
    } catch {
      return '[Decryption failed]';
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const unreadCount = inboxItems.filter(item => item.status === 'unread').length;
  const starredCount = inboxItems.filter(item => item.isStarred === 1).length;
  const archivedCount = inboxItems.filter(item => item.status === 'archived').length;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Inbox className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            Inbox
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage your encrypted messages with bulk actions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card data-testid="card-inbox">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Messages</CardTitle>
                    <CardDescription>{inboxItems.length} total messages</CardDescription>
                  </div>
                  {selectedItems.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {selectedItems.size} selected
                      </span>
                      <Button
                        data-testid="button-bulk-archive"
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction('archive')}
                        className="border-slate-200 dark:border-slate-800"
                      >
                        <Archive className="w-4 h-4 mr-1" />
                        Archive
                      </Button>
                      <Button
                        data-testid="button-bulk-delete"
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction('delete')}
                        className="border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                      <Button
                        data-testid="button-bulk-read"
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction('read')}
                        className="border-slate-200 dark:border-slate-800"
                      >
                        <MailOpen className="w-4 h-4 mr-1" />
                        Mark Read
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                  <TabsList className="grid w-full grid-cols-4 mb-4">
                    <TabsTrigger value="unread" data-testid="tab-unread">
                      Unread ({unreadCount})
                    </TabsTrigger>
                    <TabsTrigger value="read" data-testid="tab-read">
                      Read
                    </TabsTrigger>
                    <TabsTrigger value="archived" data-testid="tab-archived">
                      Archived ({archivedCount})
                    </TabsTrigger>
                    <TabsTrigger value="all" data-testid="tab-all">
                      All
                    </TabsTrigger>
                  </TabsList>

                  <div className="space-y-2">
                    {inboxItems.length > 0 && (
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                        <input
                          type="checkbox"
                          data-testid="checkbox-select-all"
                          checked={selectedItems.size === inboxItems.length}
                          onChange={selectAll}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-400">Select all</span>
                      </div>
                    )}

                    {isLoading ? (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        Loading messages...
                      </div>
                    ) : inboxItems.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No messages in this category
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {inboxItems.map((item) => (
                          <div
                            key={item.id}
                            data-testid={`inbox-item-${item.id}`}
                            className={`flex items-start gap-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                              selectedMessage?.id === item.id
                                ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                            onClick={() => setSelectedMessage(item)}
                          >
                            <input
                              type="checkbox"
                              data-testid={`checkbox-${item.id}`}
                              checked={selectedItems.has(item.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleItemSelection(item.id);
                              }}
                              className="w-4 h-4 mt-1 rounded border-slate-300 dark:border-slate-700"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {item.isStarred === 1 && (
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                )}
                                {item.status === 'unread' && (
                                  <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                )}
                                <span className={`text-sm ${
                                  item.status === 'unread' ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                                }`}>
                                  From: {item.message ? shortenAddress(item.message.fromWallet) : 'Unknown'}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                {item.message ? decryptMessage(item.message.encryptedContent).slice(0, 100) : 'No content'}...
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                {new Date(item.createdAt).toLocaleString()}
                              </p>
                            </div>

                            <span className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${
                              item.status === 'unread'
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                : item.status === 'archived'
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card data-testid="card-message-detail">
              <CardHeader>
                <CardTitle>Message Details</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedMessage ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">From</p>
                      <p className="text-sm font-mono text-slate-900 dark:text-white">
                        {selectedMessage.message?.fromWallet || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">To</p>
                      <p className="text-sm font-mono text-slate-900 dark:text-white">
                        {selectedMessage.message?.toWallet || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Message</p>
                      <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800">
                        <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">
                          {selectedMessage.message ? decryptMessage(selectedMessage.message.encryptedContent) : 'No content'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        data-testid="button-star-message"
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction(selectedMessage.isStarred === 1 ? 'unstar' : 'star')}
                        className="flex-1 border-slate-200 dark:border-slate-800"
                      >
                        <Star className={`w-4 h-4 mr-1 ${selectedMessage.isStarred === 1 ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                        {selectedMessage.isStarred === 1 ? 'Unstar' : 'Star'}
                      </Button>
                      <Button
                        data-testid="button-archive-message"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedItems(new Set([selectedMessage.id]));
                          handleBulkAction('archive');
                        }}
                        className="flex-1 border-slate-200 dark:border-slate-800"
                      >
                        <Archive className="w-4 h-4 mr-1" />
                        Archive
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    Select a message to view details
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-4" data-testid="card-inbox-stats">
              <CardHeader>
                <CardTitle className="text-sm">Inbox Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Unread</span>
                  <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">{unreadCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Starred</span>
                  <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">{starredCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Archived</span>
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{archivedCount}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">Total</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{inboxItems.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
