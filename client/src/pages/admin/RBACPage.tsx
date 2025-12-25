import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import NotionLayout from "@/components/NotionLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, Shield, Trash2, Search, X, RefreshCw } from "lucide-react";

export default function RBACPage() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { data: users, isLoading, refetch } = useQuery<Array<{
    id: string;
    email: string;
    role: string;
    createdAt: string;
  }>>({
    queryKey: ["/api/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest(`/api/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Success", description: "User role updated successfully" });
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest(`/api/users/${userId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Success", description: "User deleted successfully" });
      setDeleteUserId(null);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const filteredUsers = users?.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleStats = {
    total: users?.length || 0,
    admin: users?.filter(u => u.role === "admin").length || 0,
    viewer: users?.filter(u => u.role === "viewer").length || 0,
  };

  const sidebar = (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          Role Filters
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Filter users by role
        </p>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => setRoleFilter("all")}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            roleFilter === "all"
              ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
          }`}
          data-testid="filter-all"
        >
          <span>All Users</span>
          <Badge variant="secondary">{roleStats.total}</Badge>
        </button>

        <button
          onClick={() => setRoleFilter("admin")}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            roleFilter === "admin"
              ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
          }`}
          data-testid="filter-admin"
        >
          <span className="flex items-center gap-2">
            <Shield className="w-3 h-3" />
            Administrators
          </span>
          <Badge variant="secondary">{roleStats.admin}</Badge>
        </button>

        <button
          onClick={() => setRoleFilter("viewer")}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            roleFilter === "viewer"
              ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
          }`}
          data-testid="filter-viewer"
        >
          <span className="flex items-center gap-2">
            <Users className="w-3 h-3" />
            Viewers
          </span>
          <Badge variant="secondary">{roleStats.viewer}</Badge>
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>
    </div>
  );

  const editor = (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
          User Management (RBAC)
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Manage user roles and access control
        </p>
      </div>

      <Card data-testid="card-users-table">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Users
              </CardTitle>
              <CardDescription>
                {filteredUsers?.length || 0} users {roleFilter !== "all" ? `(filtered)` : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers && filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      data-testid={`row-user-${user.id}`}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
                      onClick={() => setSelectedUser(user)}
                    >
                      <TableCell className="font-medium text-slate-900 dark:text-white">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          data-testid={`badge-role-${user.id}`}
                          variant={user.role === "admin" ? "default" : "secondary"}
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400 text-sm">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-delete-${user.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteUserId(user.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500 dark:text-slate-400 py-12">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const properties = selectedUser ? (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          User Details
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedUser(null)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-slate-500 dark:text-slate-400">Email</Label>
          <p className="text-sm font-medium text-slate-900 dark:text-white mt-1 break-all">
            {selectedUser.email}
          </p>
        </div>

        <div>
          <Label className="text-xs text-slate-500 dark:text-slate-400">User ID</Label>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-1 break-all">
            {selectedUser.id}
          </p>
        </div>

        <div>
          <Label className="text-xs text-slate-500 dark:text-slate-400">Current Role</Label>
          <div className="mt-1">
            <Badge variant={selectedUser.role === "admin" ? "default" : "secondary"}>
              <Shield className="w-3 h-3 mr-1" />
              {selectedUser.role}
            </Badge>
          </div>
        </div>

        <div>
          <Label className="text-xs text-slate-500 dark:text-slate-400">Member Since</Label>
          <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
            {new Date(selectedUser.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <Label className="text-xs text-slate-500 dark:text-slate-400 mb-2 block">Change Role</Label>
          <select
            value={selectedUser.role}
            onChange={(e) => {
              const newRole = e.target.value;
              updateRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
            }}
            data-testid="select-role"
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            disabled={updateRoleMutation.isPending}
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => setDeleteUserId(selectedUser.id)}
          data-testid="button-delete-user"
        >
          <Trash2 className="w-3 h-3 mr-2" />
          Delete User
        </Button>
      </div>
    </div>
  ) : (
    <div className="p-4 flex items-center justify-center h-full">
      <div className="text-center text-slate-400 dark:text-slate-600">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Select a user to view details</p>
      </div>
    </div>
  );

  const toolbar = (
    <div className="flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Role-Based Access Control
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          data-testid="button-refresh"
        >
          <RefreshCw className="w-3 h-3 mr-2" />
          Refresh
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <NotionLayout
        sidebar={sidebar}
        editor={editor}
        properties={properties}
        toolbar={toolbar}
        sidebarWidth="280px"
        propertiesWidth="320px"
      />

      <DeleteUserDialog
        userId={deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onConfirm={() => deleteUserMutation.mutate(deleteUserId!)}
        isPending={deleteUserMutation.isPending}
      />
    </>
  );
}

function DeleteUserDialog({ userId, onClose, onConfirm, isPending }: any) {
  if (!userId) return null;

  return (
    <Dialog open={!!userId} onOpenChange={() => onClose()}>
      <DialogContent data-testid="dialog-delete-user">
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this user? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onClose()}
            data-testid="button-cancel-delete"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm()}
            disabled={isPending}
            data-testid="button-confirm-delete"
          >
            {isPending ? "Deleting..." : "Delete User"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
