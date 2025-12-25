import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, MotionButton } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  Cloud, Search, RefreshCw, AlertCircle, MapPin,
  Thermometer, Droplets, Wind, Plus, X, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  isDay: boolean;
}

interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  description: string;
  icon: string;
  precipitationProbability: number;
}

interface HourlyForecast {
  time: string;
  temperature: number;
  description: string;
  icon: string;
}

interface WeatherLocation {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  current?: CurrentWeather;
  addedAt?: string;
}

interface WeatherQueryResponse {
  location: { name: string; latitude: number; longitude: number; country: string; region: string };
  current: CurrentWeather;
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  receipt: { status: string };
}

interface FavoritesResponse {
  favorites: WeatherLocation[];
  count: number;
  receipt: { status: string };
}

export default function WeatherMode() {
  const { pushReceipt, wallet } = useAtlasStore();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<WeatherLocation | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const { data: favoritesData, isLoading: loadingFavorites, error: favoritesError, refetch } = useQuery<FavoritesResponse>({
    queryKey: ['/api/weather/favorites', wallet],
    enabled: !!wallet,
  });

  const { data: weatherData, isLoading: _loadingWeather } = useQuery<WeatherQueryResponse>({
    queryKey: ['/api/weather/query', selectedLocation?.name],
    queryFn: async () => {
      if (!selectedLocation) return null;
      const params = new URLSearchParams();
      if (selectedLocation.latitude && selectedLocation.longitude) {
        params.set('lat', selectedLocation.latitude.toString());
        params.set('lon', selectedLocation.longitude.toString());
      } else {
        params.set('location', selectedLocation.name);
      }
      const res = await fetch(`/api/weather/query?${params}`);
      return res.json();
    },
    enabled: !!selectedLocation,
  });

  const { data: searchResults, isLoading: searching } = useQuery<{ location: WeatherLocation }>({
    queryKey: ['/api/weather/geocode', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/weather/geocode?query=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: searchQuery.length > 2,
  });

  const addFavorite = useMutation({
    mutationFn: async (location: string) => {
      return apiRequest('/api/weather/favorites', {
        method: 'POST',
        body: JSON.stringify({ location }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weather/favorites'] });
      toast({ title: 'Added to favorites' });
      setShowSearch(false);
      setSearchQuery('');
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to add favorite', description: err.message, variant: 'destructive' });
    },
  });

  const removeFavorite = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/weather/favorites/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weather/favorites'] });
      toast({ title: 'Removed from favorites' });
    },
  });

  useEffect(() => {
    if (favoritesData?.receipt?.status === 'success') {
      pushReceipt({
        id: `receipt-weather-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.weather',
        endpoint: '/api/weather/favorites',
        timestamp: Date.now()
      });
    } else if (favoritesData?.receipt?.status === 'empty') {
      pushReceipt({
        id: `receipt-weather-empty-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.weather.empty',
        endpoint: '/api/weather/favorites',
        timestamp: Date.now()
      });
    }
  }, [favoritesData]);

  useEffect(() => {
    if (favoritesError) {
      pushReceipt({
        id: `receipt-weather-error-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.weather.error',
        endpoint: '/api/weather/favorites',
        timestamp: Date.now(),
        error: favoritesError instanceof Error ? favoritesError.message : 'Unknown error'
      });
    }
  }, [favoritesError]);

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="weather-no-wallet">
        <Cloud className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to save favorite locations</p>
      </div>
    );
  }

  if (loadingFavorites && !favoritesData) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="weather-loading">
        <MotionDiv
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (favoritesError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="weather-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load weather data</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-weather-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="weather-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-400/20 to-cyan-400/20">
            <Cloud className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-xl font-light text-white/80" data-testid="text-weather-title">Weather</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className="text-white/60 hover:text-white"
            data-testid="button-add-location"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => refetch()}
            className="text-white/60 hover:text-white p-2"
            data-testid="button-weather-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {showSearch && (
        <MotionDiv
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10"
          data-testid="search-location-form"
        >
          <div className="flex gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Search city or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                data-testid="input-location-search"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowSearch(false); setSearchQuery(''); }}
              className="text-white/60"
              data-testid="button-cancel-search"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {searching && (
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching...
            </div>
          )}

          {searchResults?.location && (
            <MotionButton
              onClick={() => addFavorite.mutate(searchResults.location.name)}
              disabled={addFavorite.isPending}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              whileHover={{ scale: 1.01 }}
              data-testid="button-add-search-result"
            >
              <MapPin className="w-4 h-4 text-blue-400" />
              <div className="text-left flex-1">
                <p className="text-white/90">{searchResults.location.name}</p>
                <p className="text-xs text-white/50">{searchResults.location.country}</p>
              </div>
              {addFavorite.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 text-cyan-400" />
              )}
            </MotionButton>
          )}
        </MotionDiv>
      )}

      {selectedLocation && weatherData?.current && (
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-400/20"
          data-testid="weather-detail-card"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-2xl font-light text-white">{selectedLocation.name}</h3>
              <p className="text-white/50 text-sm">{selectedLocation.country}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedLocation(null)}
              className="text-white/50"
              data-testid="button-close-detail"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-6 mb-6">
            <span className="text-6xl">{weatherData.current.icon}</span>
            <div>
              <p className="text-5xl font-light text-white">{Math.round(weatherData.current.temperature)}°</p>
              <p className="text-white/60">{weatherData.current.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2 text-white/70">
              <Thermometer className="w-4 h-4" />
              <span className="text-sm">Feels {Math.round(weatherData.current.feelsLike)}°</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <Droplets className="w-4 h-4" />
              <span className="text-sm">{weatherData.current.humidity}%</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <Wind className="w-4 h-4" />
              <span className="text-sm">{Math.round(weatherData.current.windSpeed)} km/h</span>
            </div>
          </div>

          {weatherData.hourly && weatherData.hourly.length > 0 && (
            <div className="mt-6">
              <p className="text-sm text-white/50 mb-3">Hourly</p>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {weatherData.hourly.slice(0, 12).map((hour, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 min-w-[60px]">
                    <span className="text-xs text-white/50">
                      {new Date(hour.time).getHours()}:00
                    </span>
                    <span className="text-xl">{hour.icon}</span>
                    <span className="text-sm text-white/80">{Math.round(hour.temperature)}°</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {weatherData.daily && weatherData.daily.length > 0 && (
            <div className="mt-6">
              <p className="text-sm text-white/50 mb-3">7-Day Forecast</p>
              <div className="space-y-2">
                {weatherData.daily.map((day, i) => (
                  <div key={i} className="flex items-center gap-4 py-2 border-b border-white/5 last:border-0">
                    <span className="w-20 text-sm text-white/70">
                      {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                    </span>
                    <span className="text-xl">{day.icon}</span>
                    <span className="flex-1 text-sm text-white/50">{day.description}</span>
                    <span className="text-sm text-white/80">{Math.round(day.tempMax)}°</span>
                    <span className="text-sm text-white/50">{Math.round(day.tempMin)}°</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </MotionDiv>
      )}

      {!selectedLocation && (
        <>
          {(!favoritesData?.favorites || favoritesData.favorites.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="weather-empty">
              <Cloud className="w-16 h-16 text-white/20 mb-4" />
              <p className="text-white/60 mb-2">No favorite locations</p>
              <p className="text-white/40 text-sm mb-4">Add cities to track their weather</p>
              <Button
                onClick={() => setShowSearch(true)}
                className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                data-testid="button-add-first-location"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Location
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="weather-favorites-list">
              {favoritesData.favorites.map((location, index) => (
                <MotionDiv
                  key={location.id}
                  className="group p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelectedLocation(location)}
                  data-testid={`card-location-${location.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{location.current?.icon || '🌤️'}</span>
                      <div>
                        <h3 className="font-medium text-white/90">{location.name}</h3>
                        <p className="text-xs text-white/50">{location.country}</p>
                      </div>
                    </div>
                    {location.current && (
                      <p className="text-2xl font-light text-white/90">
                        {Math.round(location.current.temperature)}°
                      </p>
                    )}
                  </div>

                  {location.current && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-white/50">
                      <span>{location.current.description}</span>
                      <span>💧 {location.current.humidity}%</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-4">
                    <MotionButton
                      onClick={(e) => { e.stopPropagation(); setSelectedLocation(location); }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      data-testid={`button-view-${location.id}`}
                    >
                      <Cloud className="w-4 h-4" />
                      <span className="text-sm">Details</span>
                    </MotionButton>

                    <MotionButton
                      onClick={(e) => { e.stopPropagation(); removeFavorite.mutate(location.id!); }}
                      className="p-2 rounded-lg bg-white/5 text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      data-testid={`button-remove-${location.id}`}
                    >
                      <X className="w-4 h-4" />
                    </MotionButton>
                  </div>
                </MotionDiv>
              ))}
            </div>
          )}
        </>
      )}
    </MotionDiv>
  );
}
