import { Router, Request, Response } from 'express';
import { db } from '../db';
import { weatherFavorites } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'weather-app' });
const router = Router();

interface GeoLocation {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  region?: string;
  timezone?: string;
}

interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  description: string;
  icon: string;
  isDay: boolean;
}

interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  description: string;
  icon: string;
  precipitationProbability: number;
  sunrise: string;
  sunset: string;
}

interface HourlyForecast {
  time: string;
  temperature: number;
  weatherCode: number;
  description: string;
  icon: string;
  precipitationProbability: number;
}

const WMO_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: 'Clear sky', icon: '☀️' },
  1: { description: 'Mainly clear', icon: '🌤️' },
  2: { description: 'Partly cloudy', icon: '⛅' },
  3: { description: 'Overcast', icon: '☁️' },
  45: { description: 'Foggy', icon: '🌫️' },
  48: { description: 'Depositing rime fog', icon: '🌫️' },
  51: { description: 'Light drizzle', icon: '🌧️' },
  53: { description: 'Moderate drizzle', icon: '🌧️' },
  55: { description: 'Dense drizzle', icon: '🌧️' },
  61: { description: 'Slight rain', icon: '🌧️' },
  63: { description: 'Moderate rain', icon: '🌧️' },
  65: { description: 'Heavy rain', icon: '🌧️' },
  71: { description: 'Slight snow', icon: '🌨️' },
  73: { description: 'Moderate snow', icon: '🌨️' },
  75: { description: 'Heavy snow', icon: '❄️' },
  80: { description: 'Slight rain showers', icon: '🌦️' },
  81: { description: 'Moderate rain showers', icon: '🌦️' },
  82: { description: 'Violent rain showers', icon: '⛈️' },
  95: { description: 'Thunderstorm', icon: '⛈️' },
  96: { description: 'Thunderstorm with hail', icon: '⛈️' },
  99: { description: 'Thunderstorm with heavy hail', icon: '⛈️' }
};

function getWeatherInfo(code: number): { description: string; icon: string } {
  return WMO_CODES[code] || { description: 'Unknown', icon: '❓' };
}

function getWallet(req: Request): string {
  const wallet = req.headers['x-wallet-address'] as string;
  if (!wallet) throw new Error('Missing wallet identity header');
  return wallet.toLowerCase();
}

async function geocodeLocation(query: string): Promise<GeoLocation | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    const result = data.results[0];
    return {
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      country: result.country,
      region: result.admin1,
      timezone: result.timezone
    };
  } catch (err) {
    logger.error({ error: err, query }, 'Geocoding failed');
    return null;
  }
}

async function getCurrentWeather(lat: number, lon: number): Promise<CurrentWeather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,is_day&temperature_unit=celsius&wind_speed_unit=kmh`;
    
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const current = data.current;
    const weatherInfo = getWeatherInfo(current.weather_code);

    return {
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      weatherCode: current.weather_code,
      description: weatherInfo.description,
      icon: weatherInfo.icon,
      isDay: current.is_day === 1
    };
  } catch (err) {
    logger.error({ error: err }, 'Failed to get current weather');
    return null;
  }
}

async function getDailyForecast(lat: number, lon: number, days: number = 7): Promise<DailyForecast[]> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&temperature_unit=celsius&forecast_days=${days}`;
    
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const daily = data.daily;

    return daily.time.map((date: string, i: number) => {
      const weatherInfo = getWeatherInfo(daily.weather_code[i]);
      return {
        date,
        tempMax: daily.temperature_2m_max[i],
        tempMin: daily.temperature_2m_min[i],
        weatherCode: daily.weather_code[i],
        description: weatherInfo.description,
        icon: weatherInfo.icon,
        precipitationProbability: daily.precipitation_probability_max[i],
        sunrise: daily.sunrise[i],
        sunset: daily.sunset[i]
      };
    });
  } catch (err) {
    logger.error({ error: err }, 'Failed to get daily forecast');
    return [];
  }
}

async function getHourlyForecast(lat: number, lon: number, hours: number = 24): Promise<HourlyForecast[]> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weather_code,precipitation_probability&temperature_unit=celsius&forecast_hours=${hours}`;
    
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const hourly = data.hourly;

    return hourly.time.slice(0, hours).map((time: string, i: number) => {
      const weatherInfo = getWeatherInfo(hourly.weather_code[i]);
      return {
        time,
        temperature: hourly.temperature_2m[i],
        weatherCode: hourly.weather_code[i],
        description: weatherInfo.description,
        icon: weatherInfo.icon,
        precipitationProbability: hourly.precipitation_probability[i]
      };
    });
  } catch (err) {
    logger.error({ error: err }, 'Failed to get hourly forecast');
    return [];
  }
}

router.get('/query', async (req: Request, res: Response) => {
  try {
    const { location, lat, lon } = req.query;

    let latitude: number;
    let longitude: number;
    let locationName: string;
    let country: string = '';
    let region: string = '';

    if (lat && lon) {
      latitude = parseFloat(lat as string);
      longitude = parseFloat(lon as string);
      locationName = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
    } else if (location) {
      const geo = await geocodeLocation(location as string);
      if (!geo) {
        return res.status(404).json({
          error: 'Location not found',
          receipt: { status: 'error' }
        });
      }
      latitude = geo.latitude;
      longitude = geo.longitude;
      locationName = geo.name;
      country = geo.country;
      region = geo.region || '';
    } else {
      return res.status(400).json({
        error: 'Missing location or lat/lon parameters',
        receipt: { status: 'error' }
      });
    }

    const [current, daily, hourly] = await Promise.all([
      getCurrentWeather(latitude, longitude),
      getDailyForecast(latitude, longitude, 7),
      getHourlyForecast(latitude, longitude, 24)
    ]);

    if (!current) {
      return res.status(502).json({
        error: 'Weather data unavailable',
        receipt: { status: 'error' }
      });
    }

    res.json({
      location: {
        name: locationName,
        latitude,
        longitude,
        country,
        region
      },
      current,
      daily,
      hourly,
      receipt: { status: 'success', timestamp: Date.now() }
    });
  } catch (err) {
    logger.error({ error: err }, 'Weather query failed');
    res.status(500).json({
      error: 'Weather query failed',
      receipt: { status: 'error' }
    });
  }
});

router.get('/forecast', async (req: Request, res: Response) => {
  try {
    const { location, lat, lon, days = '7' } = req.query;

    let latitude: number;
    let longitude: number;
    let locationName: string;

    if (lat && lon) {
      latitude = parseFloat(lat as string);
      longitude = parseFloat(lon as string);
      locationName = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
    } else if (location) {
      const geo = await geocodeLocation(location as string);
      if (!geo) {
        return res.status(404).json({
          error: 'Location not found',
          receipt: { status: 'error' }
        });
      }
      latitude = geo.latitude;
      longitude = geo.longitude;
      locationName = geo.name;
    } else {
      return res.status(400).json({
        error: 'Missing location or lat/lon parameters',
        receipt: { status: 'error' }
      });
    }

    const daily = await getDailyForecast(latitude, longitude, parseInt(days as string));

    res.json({
      location: { name: locationName, latitude, longitude },
      forecast: daily,
      days: daily.length,
      receipt: { status: daily.length ? 'success' : 'empty', timestamp: Date.now() }
    });
  } catch (err) {
    logger.error({ error: err }, 'Forecast query failed');
    res.status(500).json({
      error: 'Forecast query failed',
      receipt: { status: 'error' }
    });
  }
});

router.get('/favorites', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    const favorites = await db.select().from(weatherFavorites).where(eq(weatherFavorites.walletAddress, wallet));

    const favoritesWithWeather = await Promise.all(
      favorites.map(async (fav) => {
        const current = await getCurrentWeather(parseFloat(fav.latitude), parseFloat(fav.longitude));
        return {
          id: fav.id,
          name: fav.locationName,
          latitude: parseFloat(fav.latitude),
          longitude: parseFloat(fav.longitude),
          country: fav.country,
          region: fav.region,
          current,
          addedAt: fav.addedAt
        };
      })
    );

    res.json({
      favorites: favoritesWithWeather,
      count: favoritesWithWeather.length,
      receipt: { status: favoritesWithWeather.length ? 'success' : 'empty', timestamp: Date.now() }
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('wallet')) {
      return res.status(401).json({ error: err.message, receipt: { status: 'error' } });
    }
    logger.error({ error: err }, 'Failed to get favorites');
    res.status(500).json({
      error: 'Failed to get favorites',
      receipt: { status: 'error' }
    });
  }
});

router.post('/favorites', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    const { location, latitude, longitude } = req.body;

    let lat: number;
    let lon: number;
    let locationName: string;
    let country: string = '';
    let region: string = '';

    if (latitude !== undefined && longitude !== undefined) {
      lat = latitude;
      lon = longitude;
      locationName = location || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    } else if (location) {
      const geo = await geocodeLocation(location);
      if (!geo) {
        return res.status(404).json({
          error: 'Location not found',
          receipt: { status: 'error' }
        });
      }
      lat = geo.latitude;
      lon = geo.longitude;
      locationName = geo.name;
      country = geo.country;
      region = geo.region || '';
    } else {
      return res.status(400).json({
        error: 'Missing location or coordinates',
        receipt: { status: 'error' }
      });
    }

    const existing = await db.select().from(weatherFavorites).where(
      and(
        eq(weatherFavorites.walletAddress, wallet),
        eq(weatherFavorites.locationName, locationName)
      )
    );

    if (existing.length > 0) {
      return res.json({ receipt: { status: 'success', message: 'Already in favorites' } });
    }

    await db.insert(weatherFavorites).values({
      walletAddress: wallet,
      locationName,
      latitude: lat.toString(),
      longitude: lon.toString(),
      country,
      region
    });

    const current = await getCurrentWeather(lat, lon);

    res.json({
      favorite: {
        name: locationName,
        latitude: lat,
        longitude: lon,
        country,
        region,
        current
      },
      receipt: { status: 'success', timestamp: Date.now() }
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('wallet')) {
      return res.status(401).json({ error: err.message, receipt: { status: 'error' } });
    }
    logger.error({ error: err }, 'Failed to add favorite');
    res.status(500).json({
      error: 'Failed to add favorite',
      receipt: { status: 'error' }
    });
  }
});

router.delete('/favorites/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    const { id } = req.params;

    await db.delete(weatherFavorites).where(
      and(
        eq(weatherFavorites.walletAddress, wallet),
        eq(weatherFavorites.id, id)
      )
    );

    res.json({ receipt: { status: 'success', timestamp: Date.now() } });
  } catch (err) {
    if (err instanceof Error && err.message.includes('wallet')) {
      return res.status(401).json({ error: err.message, receipt: { status: 'error' } });
    }
    logger.error({ error: err }, 'Failed to remove favorite');
    res.status(500).json({
      error: 'Failed to remove favorite',
      receipt: { status: 'error' }
    });
  }
});

router.get('/geocode', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({
        error: 'Missing query parameter',
        receipt: { status: 'error' }
      });
    }

    const geo = await geocodeLocation(query as string);
    if (!geo) {
      return res.status(404).json({
        error: 'Location not found',
        receipt: { status: 'error' }
      });
    }

    res.json({
      location: geo,
      receipt: { status: 'success', timestamp: Date.now() }
    });
  } catch (err) {
    logger.error({ error: err }, 'Geocode failed');
    res.status(500).json({
      error: 'Geocode failed',
      receipt: { status: 'error' }
    });
  }
});

export default router;
