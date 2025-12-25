import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MotionDiv } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { useQuery } from '@tanstack/react-query';
import { 
  Radio, Search, Play, Pause, Volume2, VolumeX, 
  Heart, Globe, Music, SkipBack, SkipForward,
  Clock, RefreshCw, Wifi, WifiOff, Star, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { radioAudioManager } from '@/lib/radioAudioManager';

export interface RadioStation {
  id: string;
  name: string;
  country: string;
  genre: string;
  streamUrl: string;
  logo?: string;
  bitrate?: number;
  codec?: string;
  website?: string;
  priority?: number;
}

type StationHealth = 'unknown' | 'working' | 'failed';

const PRIORITY_STATIONS = new Set([
  'somafm-groovesalad', 'somafm-dronezone', 'somafm-secretagent', 'somafm-spacestation',
  'somafm-defcon', 'somafm-lush', 'somafm-beatblender', 'somafm-suburbs', 'somafm-poptron',
  'somafm-folkfwd', 'somafm-seventies', 'somafm-underground80s', 'somafm-thetrip',
  'somafm-sonicuniverse', 'somafm-metal', 'somafm-covers', 'somafm-indiepop',
  'somafm-7soul', 'somafm-bootliquor', 'somafm-bagel', 'somafm-cliqhop',
  'radio-paradise', 'radio-paradise-mellow', 'radio-paradise-rock', 'radio-paradise-world',
  'npr-1', 'kexp', 'kcrw', 'kcrw-main', 'wbgo', 'kjazz', 'kusc',
  'fip', 'fip-rock', 'fip-jazz', 'fip-electro', 'fip-world', 'fip-groove',
  'france-musique', 'france-culture',
  'nrk-p1', 'nrk-p2', 'nrk-p3', 'nrk-klassisk', 'nrk-jazz',
  'radio-swiss-jazz', 'radio-swiss-classic', 'radio-swiss-pop',
  'radio-1-nl', 'radio-2-nl', '3fm-nl', 'radio-4-nl',
  'wdr-cosmo', 'wdr-1live', 'br-klassik',
  'radio-nz', 'radio-nz-concert',
]);

const STORAGE_KEYS_HEALTH = 'atlas_radio_health';

const FALLBACK_STATIONS: RadioStation[] = [
  // CORS-friendly stations (guaranteed to work) - SomaFM & Radio Paradise first
  { id: 'somafm-groovesalad', name: 'SomaFM Groove Salad', country: 'USA', genre: 'Ambient/Chill', streamUrl: 'https://ice1.somafm.com/groovesalad-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-dronezone', name: 'SomaFM Drone Zone', country: 'USA', genre: 'Ambient', streamUrl: 'https://ice1.somafm.com/dronezone-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'radio-paradise', name: 'Radio Paradise Main', country: 'USA', genre: 'Eclectic', streamUrl: 'https://stream.radioparadise.com/aac-320', bitrate: 320, codec: 'AAC' },
  { id: 'somafm-secretagent', name: 'SomaFM Secret Agent', country: 'USA', genre: 'Lounge', streamUrl: 'https://ice1.somafm.com/secretagent-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-indiepop', name: 'SomaFM Indie Pop Rocks', country: 'USA', genre: 'Indie Pop', streamUrl: 'https://ice1.somafm.com/indiepop-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-beatblender', name: 'SomaFM Beat Blender', country: 'USA', genre: 'Electronic', streamUrl: 'https://ice1.somafm.com/beatblender-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'radio-paradise-mellow', name: 'Radio Paradise Mellow', country: 'USA', genre: 'Chill', streamUrl: 'https://stream.radioparadise.com/mellow-320', bitrate: 320, codec: 'AAC' },
  { id: 'somafm-defcon', name: 'SomaFM DEF CON', country: 'USA', genre: 'Electronic', streamUrl: 'https://ice1.somafm.com/defcon-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-sonicuniverse', name: 'SomaFM Sonic Universe', country: 'USA', genre: 'Jazz', streamUrl: 'https://ice1.somafm.com/sonicuniverse-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-7soul', name: 'SomaFM Seven Inch Soul', country: 'USA', genre: 'Soul', streamUrl: 'https://ice1.somafm.com/7soul-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-lush', name: 'SomaFM Lush', country: 'USA', genre: 'Electronica', streamUrl: 'https://ice1.somafm.com/lush-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-metal', name: 'SomaFM Metal Detector', country: 'USA', genre: 'Metal', streamUrl: 'https://ice1.somafm.com/metal-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'radio-paradise-rock', name: 'Radio Paradise Rock', country: 'USA', genre: 'Rock', streamUrl: 'https://stream.radioparadise.com/rock-320', bitrate: 320, codec: 'AAC' },
  { id: 'somafm-folkfwd', name: 'SomaFM Folk Forward', country: 'USA', genre: 'Folk/Indie', streamUrl: 'https://ice1.somafm.com/folkfwd-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-bootliquor', name: 'SomaFM Boot Liquor', country: 'USA', genre: 'Americana', streamUrl: 'https://ice1.somafm.com/bootliquor-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-spacestation', name: 'SomaFM Space Station', country: 'USA', genre: 'Space/Ambient', streamUrl: 'https://ice1.somafm.com/spacestation-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-thetrip', name: 'SomaFM The Trip', country: 'USA', genre: 'Progressive', streamUrl: 'https://ice1.somafm.com/thetrip-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-poptron', name: 'SomaFM PopTron', country: 'USA', genre: 'Synthpop', streamUrl: 'https://ice1.somafm.com/poptron-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-covers', name: 'SomaFM Covers', country: 'USA', genre: 'Cover Songs', streamUrl: 'https://ice1.somafm.com/covers-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-seventies', name: 'SomaFM Left Coast 70s', country: 'USA', genre: '70s', streamUrl: 'https://ice1.somafm.com/seventies-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-underground80s', name: 'SomaFM Underground 80s', country: 'USA', genre: '80s', streamUrl: 'https://ice1.somafm.com/u80s-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'radio-paradise-world', name: 'Radio Paradise World', country: 'USA', genre: 'World', streamUrl: 'https://stream.radioparadise.com/world-etc-320', bitrate: 320, codec: 'AAC' },
  { id: 'somafm-suburbs', name: 'SomaFM Suburbs of Goa', country: 'USA', genre: 'World/Electronic', streamUrl: 'https://ice1.somafm.com/suburbsofgoa-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-bagel', name: 'SomaFM BAGeL Radio', country: 'USA', genre: 'Eclectic', streamUrl: 'https://ice1.somafm.com/bagel-256-mp3', bitrate: 256, codec: 'MP3' },
  { id: 'somafm-cliqhop', name: 'SomaFM cliqhop idm', country: 'USA', genre: 'IDM', streamUrl: 'https://ice1.somafm.com/cliqhop-256-mp3', bitrate: 256, codec: 'MP3' },
  
  // Other stations (may have CORS restrictions)
  { id: 'npr-1', name: 'NPR News', country: 'USA', genre: 'News', streamUrl: 'https://npr-ice.streamguys1.com/live.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'kexp', name: 'KEXP 90.3 Seattle', country: 'USA', genre: 'Indie/Alternative', streamUrl: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'wnyc-fm', name: 'WNYC 93.9 FM', country: 'USA', genre: 'Public Radio', streamUrl: 'https://fm939.wnyc.org/wnycfm', bitrate: 128, codec: 'AAC' },
  { id: 'kroq', name: 'KROQ 106.7', country: 'USA', genre: 'Alternative Rock', streamUrl: 'https://stream.revma.ihrhls.com/zc1465', bitrate: 128, codec: 'AAC' },
  { id: 'hot97', name: 'Hot 97 NYC', country: 'USA', genre: 'Hip-Hop', streamUrl: 'https://stream.revma.ihrhls.com/zc1289', bitrate: 128, codec: 'AAC' },
  { id: 'power106', name: 'Power 106 LA', country: 'USA', genre: 'Hip-Hop', streamUrl: 'https://stream.revma.ihrhls.com/zc1561', bitrate: 128, codec: 'AAC' },
  { id: 'z100', name: 'Z100 NYC', country: 'USA', genre: 'Top 40', streamUrl: 'https://stream.revma.ihrhls.com/zc1281', bitrate: 128, codec: 'AAC' },
  { id: 'kiis', name: 'KIIS FM Los Angeles', country: 'USA', genre: 'Top 40', streamUrl: 'https://stream.revma.ihrhls.com/zc1557', bitrate: 128, codec: 'AAC' },
  { id: 'wbls', name: 'WBLS 107.5', country: 'USA', genre: 'R&B/Soul', streamUrl: 'https://stream.revma.ihrhls.com/zc1913', bitrate: 128, codec: 'AAC' },
  { id: 'kcrw', name: 'KCRW Eclectic 24', country: 'USA', genre: 'Eclectic', streamUrl: 'https://kcrw.streamguys1.com/kcrw_192k_mp3_e24', bitrate: 192, codec: 'MP3' },
  { id: 'kcrw-main', name: 'KCRW 89.9', country: 'USA', genre: 'Public Radio', streamUrl: 'https://kcrw.streamguys1.com/kcrw_192k_mp3_live', bitrate: 192, codec: 'MP3' },
  { id: 'kusc', name: 'KUSC Classical', country: 'USA', genre: 'Classical', streamUrl: 'https://kusc.streamguys1.com/kusc-128k.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'wqxr', name: 'WQXR Classical', country: 'USA', genre: 'Classical', streamUrl: 'https://stream.wqxr.org/wqxr', bitrate: 128, codec: 'AAC' },
  { id: 'wbgo', name: 'WBGO Jazz 88.3', country: 'USA', genre: 'Jazz', streamUrl: 'https://wbgo.streamguys1.com/wbgo128', bitrate: 128, codec: 'MP3' },
  { id: 'kjazz', name: 'KJAZZ 88.1', country: 'USA', genre: 'Jazz', streamUrl: 'https://kjazz.streamguys1.com/kjzz.mp3', bitrate: 128, codec: 'MP3' },
  
  { id: 'bbc-radio1', name: 'BBC Radio 1', country: 'UK', genre: 'Pop/Dance', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one', bitrate: 128, codec: 'AAC' },
  { id: 'bbc-radio2', name: 'BBC Radio 2', country: 'UK', genre: 'Pop/Adult', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_two', bitrate: 128, codec: 'AAC' },
  { id: 'bbc-radio3', name: 'BBC Radio 3', country: 'UK', genre: 'Classical', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_three', bitrate: 320, codec: 'AAC' },
  { id: 'bbc-radio4', name: 'BBC Radio 4', country: 'UK', genre: 'News/Talk', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_fourfm', bitrate: 128, codec: 'AAC' },
  { id: 'bbc-radio6', name: 'BBC Radio 6 Music', country: 'UK', genre: 'Alternative', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_6music', bitrate: 128, codec: 'AAC' },
  { id: 'bbc-1xtra', name: 'BBC Radio 1Xtra', country: 'UK', genre: 'Urban', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_1xtra', bitrate: 128, codec: 'AAC' },
  { id: 'bbc-asian', name: 'BBC Asian Network', country: 'UK', genre: 'World', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_asian_network', bitrate: 128, codec: 'AAC' },
  { id: 'heart-uk', name: 'Heart UK', country: 'UK', genre: 'Pop', streamUrl: 'https://media-ice.musicradio.com/HeartUK', bitrate: 128, codec: 'AAC' },
  { id: 'capital-uk', name: 'Capital FM', country: 'UK', genre: 'Pop/Dance', streamUrl: 'https://media-ice.musicradio.com/CapitalUK', bitrate: 128, codec: 'AAC' },
  { id: 'kiss-uk', name: 'Kiss FM UK', country: 'UK', genre: 'Dance/Urban', streamUrl: 'https://edge-audio-03-gos2.sharp-stream.com/kissnational.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'classicfm', name: 'Classic FM', country: 'UK', genre: 'Classical', streamUrl: 'https://media-ice.musicradio.com/ClassicFM', bitrate: 128, codec: 'AAC' },
  { id: 'lbc', name: 'LBC', country: 'UK', genre: 'Talk', streamUrl: 'https://media-ice.musicradio.com/LBC', bitrate: 128, codec: 'AAC' },
  { id: 'absolute', name: 'Absolute Radio', country: 'UK', genre: 'Rock', streamUrl: 'https://icecast.thisisdax.com/AbsoluteRadio', bitrate: 128, codec: 'AAC' },
  { id: 'absolute-80s', name: 'Absolute 80s', country: 'UK', genre: '80s', streamUrl: 'https://icecast.thisisdax.com/Absolute80s', bitrate: 128, codec: 'AAC' },
  { id: 'absolute-90s', name: 'Absolute 90s', country: 'UK', genre: '90s', streamUrl: 'https://icecast.thisisdax.com/Absolute90s', bitrate: 128, codec: 'AAC' },
  { id: 'jazzfm', name: 'Jazz FM', country: 'UK', genre: 'Jazz', streamUrl: 'https://edge-audio-03-gos2.sharp-stream.com/jazzfm.mp3', bitrate: 128, codec: 'MP3' },
  
  { id: 'triplej', name: 'Triple J', country: 'Australia', genre: 'Alternative', streamUrl: 'https://live-radio01.mediahubaustralia.com/2TJW/mp3/', bitrate: 96, codec: 'MP3' },
  { id: 'triplej-unearthed', name: 'Triple J Unearthed', country: 'Australia', genre: 'Indie', streamUrl: 'https://live-radio01.mediahubaustralia.com/XJUW/mp3/', bitrate: 96, codec: 'MP3' },
  { id: 'abc-classic', name: 'ABC Classic', country: 'Australia', genre: 'Classical', streamUrl: 'https://live-radio01.mediahubaustralia.com/2FMW/mp3/', bitrate: 96, codec: 'MP3' },
  { id: 'abc-jazz', name: 'ABC Jazz', country: 'Australia', genre: 'Jazz', streamUrl: 'https://live-radio01.mediahubaustralia.com/JAZW/mp3/', bitrate: 96, codec: 'MP3' },
  
  { id: 'cbc-radio1', name: 'CBC Radio One', country: 'Canada', genre: 'Public Radio', streamUrl: 'https://cbcliveradio-lh.akamaihd.net/i/CBCR1_TOR@118420/master.m3u8', bitrate: 128, codec: 'AAC' },
  { id: 'cbc-music', name: 'CBC Music', country: 'Canada', genre: 'Eclectic', streamUrl: 'https://cbcliveradio-lh.akamaihd.net/i/CBCR2_TOR@383112/master.m3u8', bitrate: 128, codec: 'AAC' },
  
  { id: 'rte-radio1', name: 'RTÉ Radio 1', country: 'Ireland', genre: 'Public Radio', streamUrl: 'https://icecast.rte.ie/radio1', bitrate: 128, codec: 'MP3' },
  { id: 'rte-2fm', name: 'RTÉ 2FM', country: 'Ireland', genre: 'Pop', streamUrl: 'https://icecast.rte.ie/2fm', bitrate: 128, codec: 'MP3' },
  { id: 'rte-lyric', name: 'RTÉ Lyric FM', country: 'Ireland', genre: 'Classical', streamUrl: 'https://icecast.rte.ie/lyric', bitrate: 128, codec: 'MP3' },
  
  { id: 'nrk-p1', name: 'NRK P1', country: 'Norway', genre: 'Public Radio', streamUrl: 'https://lyd.nrk.no/nrk_radio_p1_oslo_mp3_h', bitrate: 192, codec: 'MP3' },
  { id: 'nrk-p2', name: 'NRK P2', country: 'Norway', genre: 'Culture', streamUrl: 'https://lyd.nrk.no/nrk_radio_p2_mp3_h', bitrate: 192, codec: 'MP3' },
  { id: 'nrk-p3', name: 'NRK P3', country: 'Norway', genre: 'Pop/Youth', streamUrl: 'https://lyd.nrk.no/nrk_radio_p3_mp3_h', bitrate: 192, codec: 'MP3' },
  { id: 'nrk-klassisk', name: 'NRK Klassisk', country: 'Norway', genre: 'Classical', streamUrl: 'https://lyd.nrk.no/nrk_radio_klassisk_mp3_h', bitrate: 192, codec: 'MP3' },
  { id: 'nrk-jazz', name: 'NRK Jazz', country: 'Norway', genre: 'Jazz', streamUrl: 'https://lyd.nrk.no/nrk_radio_jazz_mp3_h', bitrate: 192, codec: 'MP3' },
  
  { id: 'sr-p1', name: 'Sveriges Radio P1', country: 'Sweden', genre: 'Public Radio', streamUrl: 'https://sverigesradio.se/topsy/direkt/132-hi-mp3.m3u', bitrate: 192, codec: 'MP3' },
  { id: 'sr-p2', name: 'Sveriges Radio P2', country: 'Sweden', genre: 'Classical', streamUrl: 'https://sverigesradio.se/topsy/direkt/163-hi-mp3.m3u', bitrate: 192, codec: 'MP3' },
  { id: 'sr-p3', name: 'Sveriges Radio P3', country: 'Sweden', genre: 'Pop', streamUrl: 'https://sverigesradio.se/topsy/direkt/164-hi-mp3.m3u', bitrate: 192, codec: 'MP3' },
  
  { id: 'fip', name: 'FIP France', country: 'France', genre: 'Eclectic', streamUrl: 'https://icecast.radiofrance.fr/fip-midfi.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'fip-rock', name: 'FIP Rock', country: 'France', genre: 'Rock', streamUrl: 'https://icecast.radiofrance.fr/fiprock-midfi.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'fip-jazz', name: 'FIP Jazz', country: 'France', genre: 'Jazz', streamUrl: 'https://icecast.radiofrance.fr/fipjazz-midfi.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'fip-electro', name: 'FIP Electro', country: 'France', genre: 'Electronic', streamUrl: 'https://icecast.radiofrance.fr/fipelectro-midfi.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'fip-world', name: 'FIP World', country: 'France', genre: 'World', streamUrl: 'https://icecast.radiofrance.fr/fipworld-midfi.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'fip-groove', name: 'FIP Groove', country: 'France', genre: 'Soul/Funk', streamUrl: 'https://icecast.radiofrance.fr/fipgroove-midfi.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'france-musique', name: 'France Musique', country: 'France', genre: 'Classical', streamUrl: 'https://icecast.radiofrance.fr/francemusique-midfi.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'france-culture', name: 'France Culture', country: 'France', genre: 'Culture/Talk', streamUrl: 'https://icecast.radiofrance.fr/franceculture-midfi.mp3', bitrate: 128, codec: 'MP3' },
  
  { id: 'rai-radio1', name: 'Rai Radio 1', country: 'Italy', genre: 'Public Radio', streamUrl: 'https://icestreaming.rai.it/1.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'rai-radio2', name: 'Rai Radio 2', country: 'Italy', genre: 'Pop', streamUrl: 'https://icestreaming.rai.it/2.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'rai-radio3', name: 'Rai Radio 3', country: 'Italy', genre: 'Classical', streamUrl: 'https://icestreaming.rai.it/3.mp3', bitrate: 128, codec: 'MP3' },
  
  { id: 'di-chillout', name: 'DI.fm Chillout', country: 'USA', genre: 'Chillout', streamUrl: 'https://prem2.di.fm/chillout?listen_key=public', bitrate: 128, codec: 'AAC' },
  { id: 'di-trance', name: 'DI.fm Trance', country: 'USA', genre: 'Trance', streamUrl: 'https://prem2.di.fm/trance?listen_key=public', bitrate: 128, codec: 'AAC' },
  { id: 'di-house', name: 'DI.fm House', country: 'USA', genre: 'House', streamUrl: 'https://prem2.di.fm/house?listen_key=public', bitrate: 128, codec: 'AAC' },
  { id: 'di-deephouse', name: 'DI.fm Deep House', country: 'USA', genre: 'Deep House', streamUrl: 'https://prem2.di.fm/deephouse?listen_key=public', bitrate: 128, codec: 'AAC' },
  { id: 'di-techno', name: 'DI.fm Techno', country: 'USA', genre: 'Techno', streamUrl: 'https://prem2.di.fm/techno?listen_key=public', bitrate: 128, codec: 'AAC' },
  { id: 'di-drumandbass', name: 'DI.fm Drum & Bass', country: 'USA', genre: 'Drum & Bass', streamUrl: 'https://prem2.di.fm/drumandbass?listen_key=public', bitrate: 128, codec: 'AAC' },
  { id: 'di-lounge', name: 'DI.fm Lounge', country: 'USA', genre: 'Lounge', streamUrl: 'https://prem2.di.fm/lounge?listen_key=public', bitrate: 128, codec: 'AAC' },
  { id: 'di-ambient', name: 'DI.fm Ambient', country: 'USA', genre: 'Ambient', streamUrl: 'https://prem2.di.fm/ambient?listen_key=public', bitrate: 128, codec: 'AAC' },
  
  { id: 'wdr-cosmo', name: 'WDR COSMO', country: 'Germany', genre: 'World', streamUrl: 'https://wdr-cosmo-live.icecast.wdr.de/wdr/cosmo/live/mp3/128/stream.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'wdr-1live', name: 'WDR 1LIVE', country: 'Germany', genre: 'Pop', streamUrl: 'https://wdr-1live-live.icecast.wdr.de/wdr/1live/live/mp3/128/stream.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'br-klassik', name: 'BR-KLASSIK', country: 'Germany', genre: 'Classical', streamUrl: 'https://dispatcher.rndfnk.com/br/brklassik/live/mp3/mid', bitrate: 128, codec: 'MP3' },
  { id: 'flux-fm', name: 'FluxFM', country: 'Germany', genre: 'Alternative', streamUrl: 'https://fluxfm.streamabc.net/flx-fluxfm-mp3-128-3618489', bitrate: 128, codec: 'MP3' },
  
  { id: 'radio-swiss-jazz', name: 'Radio Swiss Jazz', country: 'Switzerland', genre: 'Jazz', streamUrl: 'https://stream.srg-ssr.ch/m/rsj/mp3_128', bitrate: 128, codec: 'MP3' },
  { id: 'radio-swiss-classic', name: 'Radio Swiss Classic', country: 'Switzerland', genre: 'Classical', streamUrl: 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128', bitrate: 128, codec: 'MP3' },
  { id: 'radio-swiss-pop', name: 'Radio Swiss Pop', country: 'Switzerland', genre: 'Pop', streamUrl: 'https://stream.srg-ssr.ch/m/rsp/mp3_128', bitrate: 128, codec: 'MP3' },
  
  { id: 'radio-1-nl', name: 'NPO Radio 1', country: 'Netherlands', genre: 'News/Talk', streamUrl: 'https://icecast.omroep.nl/radio1-bb-mp3', bitrate: 192, codec: 'MP3' },
  { id: 'radio-2-nl', name: 'NPO Radio 2', country: 'Netherlands', genre: 'Pop', streamUrl: 'https://icecast.omroep.nl/radio2-bb-mp3', bitrate: 192, codec: 'MP3' },
  { id: '3fm-nl', name: 'NPO 3FM', country: 'Netherlands', genre: 'Alternative', streamUrl: 'https://icecast.omroep.nl/3fm-bb-mp3', bitrate: 192, codec: 'MP3' },
  { id: 'radio-4-nl', name: 'NPO Radio 4', country: 'Netherlands', genre: 'Classical', streamUrl: 'https://icecast.omroep.nl/radio4-bb-mp3', bitrate: 192, codec: 'MP3' },
  
  { id: 'radio-3-spain', name: 'Radio 3 Spain', country: 'Spain', genre: 'Alternative', streamUrl: 'https://rtvelivestream.akamaized.net/rtvesec/r3_main.m3u8', bitrate: 128, codec: 'AAC' },
  { id: 'radio-clasica', name: 'Radio Clásica', country: 'Spain', genre: 'Classical', streamUrl: 'https://rtvelivestream.akamaized.net/rtvesec/rne_r2_main.m3u8', bitrate: 128, codec: 'AAC' },
  
  { id: 'nhk-world', name: 'NHK World Radio Japan', country: 'Japan', genre: 'News', streamUrl: 'https://nhkworld.webcdn.stream.ne.jp/www11/nhkworld-radio/domestic/live_wa_s.m3u8', bitrate: 64, codec: 'AAC' },
  { id: 'j-wave', name: 'J-WAVE 81.3 FM', country: 'Japan', genre: 'Pop', streamUrl: 'https://musicbird.leanstream.co/JCB073-MP3', bitrate: 128, codec: 'MP3' },
  
  { id: 'radio-nz', name: 'Radio New Zealand National', country: 'New Zealand', genre: 'Public Radio', streamUrl: 'https://radionz-stream.rnz.co.nz/rnz_national.mp3', bitrate: 128, codec: 'MP3' },
  { id: 'radio-nz-concert', name: 'RNZ Concert', country: 'New Zealand', genre: 'Classical', streamUrl: 'https://radionz-stream.rnz.co.nz/rnz_concert.mp3', bitrate: 128, codec: 'MP3' },
];

const FALLBACK_GENRES = [...new Set(FALLBACK_STATIONS.map(s => s.genre))].sort();
const FALLBACK_COUNTRIES = [...new Set(FALLBACK_STATIONS.map(s => s.country))].sort();

const STORAGE_KEYS = {
  FAVORITES: 'atlas_radio_favorites',
  RECENT: 'atlas_radio_recent',
  VOLUME: 'atlas_radio_volume',
};

function AudioVisualizer({ audioContext, sourceNode, isPlaying }: { 
  audioContext: AudioContext | null; 
  sourceNode: MediaElementAudioSourceNode | null;
  isPlaying: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  
  useEffect(() => {
    if (!audioContext || !sourceNode || !canvasRef.current) return;
    
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 64;
    analyzer.smoothingTimeConstant = 0.8;
    sourceNode.connect(analyzer);
    analyzer.connect(audioContext.destination);
    analyzerRef.current = analyzer;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);
      
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      
      const barWidth = (width / bufferLength) * 0.8;
      const gap = (width / bufferLength) * 0.2;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.9;
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.8)');
        gradient.addColorStop(1, 'rgba(236, 72, 153, 0.8)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + gap;
      }
    };
    
    if (isPlaying) {
      draw();
    }
    
    return () => {
      cancelAnimationFrame(animationRef.current);
      if (analyzerRef.current) {
        analyzerRef.current.disconnect();
      }
    };
  }, [audioContext, sourceNode, isPlaying]);
  
  return (
    <canvas 
      ref={canvasRef} 
      width={200} 
      height={40}
      className="opacity-80"
      data-testid="audio-visualizer"
    />
  );
}

function StationCard({ 
  station, 
  isFavorite, 
  isPlaying,
  health,
  isPriority,
  onPlay, 
  onToggleFavorite 
}: { 
  station: RadioStation;
  isFavorite: boolean;
  isPlaying: boolean;
  health: StationHealth;
  isPriority: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
}) {
  const isFailed = health === 'failed';
  
  return (
    <MotionDiv
      className={`group relative p-4 rounded-xl border transition-all cursor-pointer ${
        isFailed
          ? 'bg-red-500/5 border-red-500/20 opacity-60'
          : isPlaying 
            ? 'bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border-cyan-500/40 shadow-lg shadow-cyan-500/10' 
            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
      }`}
      whileHover={{ scale: isFailed ? 1 : 1.02 }}
      whileTap={{ scale: isFailed ? 1 : 0.98 }}
      onClick={onPlay}
      data-testid={`card-station-${station.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden ${
          isFailed 
            ? 'bg-red-500/10' 
            : 'bg-gradient-to-br from-purple-500/20 to-cyan-500/20'
        }`}>
          {station.logo ? (
            <img 
              src={station.logo} 
              alt={station.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : isFailed ? (
            <WifiOff className="w-6 h-6 text-red-400" />
          ) : (
            <Radio className="w-6 h-6 text-cyan-400" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white truncate text-sm">{station.name}</h3>
            {isPlaying && (
              <span className="flex items-center gap-1 text-xs text-cyan-400 flex-shrink-0">
                <Wifi className="w-3 h-3 animate-pulse" />
              </span>
            )}
            {health === 'working' && !isPlaying && (
              <span className="flex items-center gap-1 text-xs text-green-400 flex-shrink-0" title="Recently verified working">
                <Wifi className="w-3 h-3" />
              </span>
            )}
            {isFailed && (
              <span className="flex items-center gap-1 text-xs text-red-400 flex-shrink-0" title="Stream unavailable">
                <WifiOff className="w-3 h-3" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
              {station.genre}
            </span>
            <span className="text-xs text-white/40 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {station.country}
            </span>
            {isPriority && health !== 'failed' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400" title="Recommended station">
                <Star className="w-2.5 h-2.5 fill-current" />
              </span>
            )}
          </div>
          {station.bitrate && (
            <div className="text-xs text-white/30 mt-1">
              {station.bitrate}kbps {station.codec}
              {isFailed && <span className="text-red-400 ml-2">• Unavailable</span>}
            </div>
          )}
        </div>
      </div>
      
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 rounded-full ${
            isFavorite 
              ? 'bg-pink-500/20 text-pink-400' 
              : 'bg-white/10 text-white/60 hover:text-pink-400'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          data-testid={`button-favorite-${station.id}`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
        </Button>
      </div>
      
      {isPlaying && (
        <div className="absolute -bottom-px left-4 right-4 h-0.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full" />
      )}
    </MotionDiv>
  );
}

function NowPlayingBar({
  station,
  isPlaying,
  volume,
  onPlayPause,
  onVolumeChange,
  onPrevious,
  onNext,
  audioContext,
  sourceNode,
  isBuffering,
  error,
}: {
  station: RadioStation;
  isPlaying: boolean;
  volume: number;
  onPlayPause: () => void;
  onVolumeChange: (v: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  audioContext: AudioContext | null;
  sourceNode: MediaElementAudioSourceNode | null;
  isBuffering: boolean;
  error: string | null;
}) {
  const [showVolume, setShowVolume] = useState(false);
  
  return (
    <MotionDiv
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-20 left-0 right-0 z-50 bg-gradient-to-t from-slate-900 via-slate-900/95 to-slate-900/90 border-t border-white/10 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      data-testid="now-playing-bar"
    >
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        
        <div className="px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/30 to-cyan-500/30 flex items-center justify-center overflow-hidden flex-shrink-0">
              <Radio className="w-6 h-6 text-cyan-400" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-white truncate text-sm">{station.name}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-white/50">{station.genre}</span>
                {isBuffering && (
                  <span className="text-xs text-amber-400 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Buffering...
                  </span>
                )}
                {error && (
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" />
                    {error}
                  </span>
                )}
              </div>
            </div>
            
            <div className="hidden sm:block w-48">
              <AudioVisualizer 
                audioContext={audioContext} 
                sourceNode={sourceNode} 
                isPlaying={isPlaying && !isBuffering}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-full text-white/60 hover:text-white hover:bg-white/10"
                onClick={onPrevious}
                data-testid="button-previous"
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white"
                onClick={onPlayPause}
                data-testid="button-play-pause"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-full text-white/60 hover:text-white hover:bg-white/10"
                onClick={onNext}
                data-testid="button-next"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
              
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 rounded-full text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setShowVolume(!showVolume)}
                  data-testid="button-volume"
                >
                  {volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
                
                {showVolume && (
                  <div className="absolute bottom-full right-0 mb-2 p-3 bg-slate-800 rounded-lg border border-white/10 shadow-xl">
                    <Slider
                      value={[volume]}
                      onValueChange={([v]) => onVolumeChange(v)}
                      max={100}
                      step={1}
                      className="w-24"
                      data-testid="slider-volume"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MotionDiv>
  );
}

export default function RadioMode() {
  const { addRunningApp, updateRunningApp, removeRunningApp, setRadioStation, setRadioPlaying, setRadioVolume } = useAtlasStore();
  const { toast } = useToast();
  
  const { data: stationsData, isLoading: stationsLoading } = useQuery<{
    stations: RadioStation[];
    filters: { genres: string[]; countries: string[] };
    total: number;
  }>({
    queryKey: ['/api/radio/browse'],
    staleTime: 5 * 60 * 1000,
  });
  
  const allStations = stationsData?.stations || FALLBACK_STATIONS;
  const GENRES = stationsData?.filters?.genres || FALLBACK_GENRES;
  const COUNTRIES = stationsData?.filters?.countries || FALLBACK_COUNTRIES;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [volume, setVolume] = useState(80);
  
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<string[]>([]);
  const [stationHealth, setStationHealth] = useState<Record<string, StationHealth>>({});
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const runningAppIdRef = useRef<string | null>(null);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 2;
  const failedStationsRef = useRef<Set<string>>(new Set());
  const lastUserSelectionRef = useRef<string | null>(null);
  
  useEffect(() => {
    const savedFavorites = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    const savedRecent = localStorage.getItem(STORAGE_KEYS.RECENT);
    const savedVolume = localStorage.getItem(STORAGE_KEYS.VOLUME);
    const savedHealth = localStorage.getItem(STORAGE_KEYS_HEALTH);
    
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    if (savedRecent) setRecentlyPlayed(JSON.parse(savedRecent));
    if (savedVolume) setVolume(parseInt(savedVolume, 10));
    if (savedHealth) {
      try {
        const healthData = JSON.parse(savedHealth);
        const now = Date.now();
        const filteredHealth: Record<string, StationHealth> = {};
        for (const [id, data] of Object.entries(healthData)) {
          const { status, timestamp } = data as { status: StationHealth; timestamp: number };
          if (now - timestamp < 24 * 60 * 60 * 1000) {
            filteredHealth[id] = status;
          }
        }
        setStationHealth(filteredHealth);
      } catch (e) {
        console.error('[RadioMode] Failed to load health data:', e);
      }
    }
  }, []);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  }, [favorites]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(recentlyPlayed));
  }, [recentlyPlayed]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOLUME, volume.toString());
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
    setRadioVolume(volume);
  }, [volume, setRadioVolume]);
  
  useEffect(() => {
    audioRef.current = radioAudioManager.getAudioElement();
    
    radioAudioManager.subscribe('radioMode', {
      onPlaying: () => { setIsBuffering(false); setPlayError(null); },
      onBuffering: (buffering) => setIsBuffering(buffering),
      onError: (msg) => setPlayError(msg)
    });
    
    const globalRadio = useAtlasStore.getState().radio;
    if (globalRadio.currentStation && globalRadio.isPlaying) {
      setCurrentStation(globalRadio.currentStation);
      setIsPlaying(true);
      setVolume(globalRadio.volume);
    }
    
    return () => {
      radioAudioManager.unsubscribe('radioMode');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      failedStationsRef.current.clear();
      lastUserSelectionRef.current = null;
    };
  }, []);
  
  const updateStationHealth = useCallback((stationId: string, status: StationHealth) => {
    setStationHealth(prev => {
      const newHealth = { ...prev, [stationId]: status };
      try {
        const existingData = localStorage.getItem(STORAGE_KEYS_HEALTH);
        const healthData = existingData ? JSON.parse(existingData) : {};
        healthData[stationId] = { status, timestamp: Date.now() };
        localStorage.setItem(STORAGE_KEYS_HEALTH, JSON.stringify(healthData));
      } catch (e) {
        console.error('[RadioMode] Failed to save health data:', e);
      }
      return newHealth;
    });
  }, []);

  const setupMediaSession = useCallback((station: RadioStation) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.name,
        artist: station.genre,
        album: station.country,
        artwork: station.logo ? [{ src: station.logo, sizes: '512x512', type: 'image/png' }] : []
      });
      
      navigator.mediaSession.setActionHandler('play', () => playStation(station));
      navigator.mediaSession.setActionHandler('pause', pauseStation);
      navigator.mediaSession.setActionHandler('previoustrack', playPreviousStation);
      navigator.mediaSession.setActionHandler('nexttrack', playNextStation);
    }
  }, []);
  
  const getStreamUrl = useCallback((station: RadioStation, useProxy: boolean = false): string => {
    if (useProxy) {
      return `/api/atlas/streaming/v2/stream/${station.id}`;
    }
    return station.streamUrl;
  }, []);

  const playStation = useCallback(async (station: RadioStation, isRetry: boolean = false, useProxy: boolean = true) => {
    if (!audioRef.current) return;
    
    if (failedStationsRef.current.has(station.id)) {
      toast({
        title: 'Station Unavailable',
        description: `${station.name} failed earlier this session. Please try a different station.`,
        variant: 'destructive',
      });
      return;
    }
    
    if (!isRetry) {
      retryCountRef.current = 0;
      lastUserSelectionRef.current = station.id;
    }
    
    setPlayError(null);
    setIsBuffering(true);
    
    const streamUrl = getStreamUrl(station, useProxy);
    
    const isNewStation = currentStation?.id !== station.id;
    if (isNewStation) {
      setCurrentStation(station);
      
      setRecentlyPlayed(prev => {
        const filtered = prev.filter(id => id !== station.id);
        return [station.id, ...filtered].slice(0, 20);
      });
      
      addRunningApp({
        mode: 'radio',
        name: station.name,
        icon: 'Radio',
        state: 'playing',
        metadata: {
          title: station.name,
          subtitle: `${station.genre} • ${station.country}`,
        },
        supportsPip: false,
      });
      
      const apps = useAtlasStore.getState().runningApps;
      const myApp = apps.find(a => a.mode === 'radio');
      if (myApp) runningAppIdRef.current = myApp.id;
    }
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      if (!sourceNodeRef.current && audioRef.current) {
        sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      }
      
      radioAudioManager.setVolume(volume);
      await radioAudioManager.play(station, streamUrl);
      
      setIsPlaying(true);
      setIsBuffering(false);
      retryCountRef.current = 0;
      
      setRadioStation(station, streamUrl);
      setRadioPlaying(true);
      setRadioVolume(volume);
      
      updateStationHealth(station.id, 'working');
      
      setupMediaSession(station);
      
      if (runningAppIdRef.current) {
        updateRunningApp(runningAppIdRef.current, { state: 'playing' });
      }
      
      toast({
        title: 'Now Playing',
        description: `${station.name} - ${station.genre}`,
      });
    } catch (err) {
      console.error('[RadioMode] Playback error:', err);
      retryCountRef.current++;
      
      if (useProxy && retryCountRef.current === 1) {
        console.log('[RadioMode] Proxy failed, trying direct stream...');
        setPlayError('Trying direct stream...');
        reconnectTimeoutRef.current = setTimeout(() => {
          playStation(station, true, false);
        }, 500);
      } else if (retryCountRef.current <= maxRetries) {
        setPlayError(`Retrying... (${retryCountRef.current}/${maxRetries})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (currentStation?.id === station.id) {
            playStation(station, true, useProxy);
          }
        }, 2000);
      } else {
        failedStationsRef.current.add(station.id);
        updateStationHealth(station.id, 'failed');
        setPlayError('Stream unavailable');
        setIsPlaying(false);
        setIsBuffering(false);
        
        toast({
          title: 'Station Unavailable',
          description: `${station.name} could not be played. It may be geo-restricted or offline. Please select another station.`,
          variant: 'destructive',
        });
      }
    }
  }, [currentStation, volume, toast, setupMediaSession, addRunningApp, updateRunningApp, updateStationHealth, getStreamUrl, setRadioStation, setRadioPlaying, setRadioVolume]);
  
  const pauseStation = useCallback(() => {
    radioAudioManager.pause();
    setIsPlaying(false);
    
    if (runningAppIdRef.current) {
      updateRunningApp(runningAppIdRef.current, { state: 'paused' });
    }
  }, [updateRunningApp]);
  
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseStation();
    } else if (currentStation) {
      playStation(currentStation);
    }
  }, [isPlaying, currentStation, playStation, pauseStation]);
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _closePlayer = useCallback(() => {
    radioAudioManager.pause();
    if (runningAppIdRef.current) {
      removeRunningApp(runningAppIdRef.current);
      runningAppIdRef.current = null;
    }
    setCurrentStation(null);
    setIsPlaying(false);
    setIsBuffering(false);
    setPlayError(null);
    setRadioStation(null);
  }, [removeRunningApp, setRadioStation]);
  void _closePlayer; // Prevent unused variable warning
  
  const getCurrentStationIndex = useCallback(() => {
    if (!currentStation) return -1;
    return allStations.findIndex(s => s.id === currentStation.id);
  }, [currentStation, allStations]);
  
  const playPreviousStation = useCallback(() => {
    const currentIndex = getCurrentStationIndex();
    if (currentIndex <= 0) {
      playStation(allStations[allStations.length - 1]);
    } else {
      playStation(allStations[currentIndex - 1]);
    }
  }, [getCurrentStationIndex, playStation, allStations]);
  
  const playNextStation = useCallback(() => {
    const currentIndex = getCurrentStationIndex();
    if (currentIndex >= allStations.length - 1) {
      playStation(allStations[0]);
    } else {
      playStation(allStations[currentIndex + 1]);
    }
  }, [getCurrentStationIndex, playStation, allStations]);
  
  const toggleFavorite = useCallback((stationId: string) => {
    setFavorites(prev => {
      if (prev.includes(stationId)) {
        return prev.filter(id => id !== stationId);
      }
      return [...prev, stationId];
    });
  }, []);
  
  const filteredStations = useMemo(() => {
    let stations = allStations;
    
    if (showFavorites) {
      stations = stations.filter(s => favorites.includes(s.id));
    } else if (showRecent) {
      const recentStations = recentlyPlayed
        .map(id => stations.find(s => s.id === id))
        .filter(Boolean) as RadioStation[];
      stations = recentStations;
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      stations = stations.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.genre.toLowerCase().includes(query) ||
        s.country.toLowerCase().includes(query)
      );
    }
    
    if (selectedGenre !== 'all') {
      stations = stations.filter(s => s.genre === selectedGenre);
    }
    
    if (selectedCountry !== 'all') {
      stations = stations.filter(s => s.country === selectedCountry);
    }
    
    if (!showRecent) {
      stations = [...stations].sort((a, b) => {
        const aHealth = stationHealth[a.id] || 'unknown';
        const bHealth = stationHealth[b.id] || 'unknown';
        const aIsPriority = PRIORITY_STATIONS.has(a.id);
        const bIsPriority = PRIORITY_STATIONS.has(b.id);
        
        if (aHealth === 'failed' && bHealth !== 'failed') return 1;
        if (bHealth === 'failed' && aHealth !== 'failed') return -1;
        
        if (aHealth === 'working' && bHealth !== 'working') return -1;
        if (bHealth === 'working' && aHealth !== 'working') return 1;
        
        if (aIsPriority && !bIsPriority) return -1;
        if (bIsPriority && !aIsPriority) return 1;
        
        return 0;
      });
    }
    
    return stations;
  }, [allStations, searchQuery, selectedGenre, selectedCountry, showFavorites, showRecent, favorites, recentlyPlayed, stationHealth]);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setPlayError(null);
    };
    const handleError = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      retryCountRef.current++;
      
      if (retryCountRef.current <= maxRetries && currentStation && !failedStationsRef.current.has(currentStation.id)) {
        setPlayError(`Retrying... (${retryCountRef.current}/${maxRetries})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (currentStation && lastUserSelectionRef.current === currentStation.id) {
            playStation(currentStation, true);
          }
        }, 2000);
      } else {
        if (currentStation) {
          failedStationsRef.current.add(currentStation.id);
          updateStationHealth(currentStation.id, 'failed');
          toast({
            title: 'Station Unavailable',
            description: `${currentStation.name} could not be played. Please select another station.`,
            variant: 'destructive',
          });
        }
        setPlayError('Stream unavailable');
        setIsBuffering(false);
        setIsPlaying(false);
        retryCountRef.current = 0;
      }
    };
    const handleEnded = () => {
      if (currentStation && !failedStationsRef.current.has(currentStation.id)) {
        setPlayError('Stream ended, reconnecting...');
        reconnectTimeoutRef.current = setTimeout(() => {
          if (currentStation && lastUserSelectionRef.current === currentStation.id) {
            playStation(currentStation, true);
          }
        }, 1000);
      }
    };
    
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentStation, playStation, updateStationHealth, toast]);
  
  return (
    <MotionDiv
      className="h-full flex flex-col relative pb-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      data-testid="radio-mode"
    >
      <div className="flex-shrink-0 p-4 border-b border-white/10 bg-gradient-to-b from-slate-900/50 to-transparent">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20">
              <Radio className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white" data-testid="text-radio-title">
                {showFavorites ? 'Favorite Stations' : showRecent ? 'Recently Played' : 'World Radio'}
              </h2>
              <p className="text-xs text-white/40">
                {stationsLoading ? 'Loading...' : `${allStations.length} stations from ${COUNTRIES.length} countries`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant={showRecent ? "default" : "ghost"}
              size="sm"
              onClick={() => { setShowRecent(!showRecent); setShowFavorites(false); }}
              className={showRecent ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "text-white/60 hover:text-white"}
              data-testid="button-toggle-recent"
            >
              <Clock className="w-4 h-4 mr-1.5" />
              Recent
            </Button>
            <Button 
              variant={showFavorites ? "default" : "ghost"}
              size="sm"
              onClick={() => { setShowFavorites(!showFavorites); setShowRecent(false); }}
              className={showFavorites ? "bg-pink-500/20 text-pink-400 border border-pink-500/30" : "text-white/60 hover:text-white"}
              data-testid="button-toggle-favorites"
            >
              <Star className={`w-4 h-4 mr-1.5 ${showFavorites ? 'fill-current' : ''}`} />
              Favorites
            </Button>
          </div>
        </div>
        
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Search stations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-pink-500/50"
              data-testid="input-radio-search"
            />
          </div>
          
          <Select value={selectedGenre} onValueChange={setSelectedGenre}>
            <SelectTrigger className="w-[150px] bg-white/5 border-white/10 text-white" data-testid="select-genre">
              <Music className="w-4 h-4 mr-2 text-white/40" />
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 max-h-[300px]">
              <SelectItem value="all" className="text-white hover:bg-white/10">All Genres</SelectItem>
              {GENRES.map(genre => (
                <SelectItem key={genre} value={genre} className="text-white hover:bg-white/10">
                  {genre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="w-[150px] bg-white/5 border-white/10 text-white" data-testid="select-country">
              <Globe className="w-4 h-4 mr-2 text-white/40" />
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 max-h-[300px]">
              <SelectItem value="all" className="text-white hover:bg-white/10">All Countries</SelectItem>
              {COUNTRIES.map(country => (
                <SelectItem key={country} value={country} className="text-white hover:bg-white/10">
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
          <Filter className="w-3 h-3" />
          <span>Showing {filteredStations.length} of {allStations.length} stations</span>
        </div>
      </div>
      
      <div 
        className="flex-1 overflow-auto p-4 pb-32"
        data-testid="radio-station-list"
      >
        {filteredStations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <Radio className="w-16 h-16 text-white/10 mb-4" />
            <p className="text-white/60 mb-2">
              {showFavorites ? 'No favorite stations yet' : showRecent ? 'No recently played stations' : 'No stations found'}
            </p>
            <p className="text-white/40 text-sm max-w-xs">
              {showFavorites 
                ? 'Click the star icon on any station to add it to your favorites' 
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredStations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                isFavorite={favorites.includes(station.id)}
                isPlaying={currentStation?.id === station.id && isPlaying}
                health={stationHealth[station.id] || 'unknown'}
                isPriority={PRIORITY_STATIONS.has(station.id)}
                onPlay={() => playStation(station)}
                onToggleFavorite={() => toggleFavorite(station.id)}
              />
            ))}
          </div>
        )}
      </div>
      
      {currentStation && (
        <NowPlayingBar
          station={currentStation}
          isPlaying={isPlaying}
          volume={volume}
          onPlayPause={togglePlayPause}
          onVolumeChange={setVolume}
          onPrevious={playPreviousStation}
          onNext={playNextStation}
          audioContext={audioContextRef.current}
          sourceNode={sourceNodeRef.current}
          isBuffering={isBuffering}
          error={playError}
        />
      )}
    </MotionDiv>
  );
}
