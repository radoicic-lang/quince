import React, { useState, useEffect } from 'react';
import { Folder, ChevronRight, ChevronLeft, File, Clock, MapPin, Building2, ExternalLink, Info, X, Image as ImageIcon, FileText, Video, Download, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// --- Mock Data & Types ---
interface DriveFolder {
  id: string;
  name: string;
  createdTime: string;
  webViewLink: string;
  itemCount: number;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailLink?: string;
  createdTime: string;
}

// Helper to check if a date is within the last 7 days
const isNew = (dateString: string) => {
  const createdDate = new Date(dateString);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return createdDate >= sevenDaysAgo;
};

// Helper for file icons
const getFileIcon = (mimeType: string, className: string = "h-5 w-5") => {
  if (mimeType.startsWith('image/')) return <ImageIcon className={`${className} text-blue-400`} />;
  if (mimeType.startsWith('video/')) return <Video className={`${className} text-purple-400`} />;
  if (mimeType === 'application/pdf') return <FileText className={`${className} text-red-400`} />;
  return <File className={`${className} text-white/70`} />;
};

// Mock data to simulate Google Drive response
const MOCK_FOLDERS: DriveFolder[] = [
  {
    id: '1',
    name: 'Construction 26-03-05',
    createdTime: new Date().toISOString(), // Today (New)
    webViewLink: '#',
    itemCount: 24,
  },
  {
    id: '2',
    name: 'Site Visit 26-02-28',
    createdTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago (New)
    webViewLink: '#',
    itemCount: 12,
  },
  {
    id: '3',
    name: 'Foundation Pour 26-02-15',
    createdTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days ago
    webViewLink: '#',
    itemCount: 45,
  },
  {
    id: '4',
    name: 'Initial Survey 26-01-10',
    createdTime: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
    webViewLink: '#',
    itemCount: 8,
  },
  {
    id: '5',
    name: 'Permits & Approvals',
    createdTime: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
    webViewLink: '#',
    itemCount: 15,
  },
  {
    id: '6',
    name: 'Architectural Plans',
    createdTime: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
    webViewLink: '#',
    itemCount: 32,
  },
  {
    id: '7',
    name: 'Contractor Agreements',
    createdTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    webViewLink: '#',
    itemCount: 5,
  },
  {
    id: '8',
    name: 'Environmental Reports',
    createdTime: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
    webViewLink: '#',
    itemCount: 3,
  },
];

const MOCK_FILES: Record<string, DriveFile[]> = {
  '1': [
    { id: 'f1', name: 'Site_Overview_Front.jpg', mimeType: 'image/jpeg', webViewLink: '#', thumbnailLink: 'https://picsum.photos/seed/site1/200/200', createdTime: new Date().toISOString() },
    { id: 'f2', name: 'Weekly_Progress_Report.pdf', mimeType: 'application/pdf', webViewLink: '#', createdTime: new Date().toISOString() },
    { id: 'f3', name: 'Drone_Flyover.mp4', mimeType: 'video/mp4', webViewLink: '#', thumbnailLink: 'https://picsum.photos/seed/drone/200/200', createdTime: new Date().toISOString() },
    { id: 'f4', name: 'Material_Delivery_Log.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', webViewLink: '#', createdTime: new Date().toISOString() },
  ],
  '2': [
    { id: 'f5', name: 'Foundation_Inspection.pdf', mimeType: 'application/pdf', webViewLink: '#', createdTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'f6', name: 'Rebar_Placement.jpg', mimeType: 'image/jpeg', webViewLink: '#', thumbnailLink: 'https://picsum.photos/seed/rebar/200/200', createdTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  ]
};

export default function App() {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDevNotes, setShowDevNotes] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [apiDisabled, setApiDisabled] = useState(false);
  const [folderNotFound, setFolderNotFound] = useState(false);
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null);
  const [downloadingFolderId, setDownloadingFolderId] = useState<string | null>(null);
  
  // File Preview Modal State
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
  const [folderFiles, setFolderFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [carouselImages, setCarouselImages] = useState<string[]>([
    "https://picsum.photos/seed/build1/800/600",
    "https://picsum.photos/seed/build2/800/600",
    "https://picsum.photos/seed/build3/800/600",
    "https://picsum.photos/seed/build4/800/600",
  ]);

  useEffect(() => {
    if (carouselImages.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [carouselImages.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);

  // Client-side API Key & Folder ID
  const API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
  const FOLDER_ID = import.meta.env.VITE_DRIVE_FOLDER_ID || '16M436N3T16wjlj-yV8YOrwddkdWwCYDx';

  // Fetch images from the latest folder for the gallery
  useEffect(() => {
    const fetchLatestImages = async () => {
      if (folders.length === 0) return;
      
      const latestFolder = folders[0];
      let files: DriveFile[] = [];
      
      if (MOCK_FOLDERS.some(f => f.id === latestFolder.id)) {
        files = MOCK_FILES[latestFolder.id] || MOCK_FILES['1'];
      } else {
        try {
          let response;
          if (API_KEY) {
            response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${latestFolder.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink,thumbnailLink,createdTime)&orderBy=createdTime+desc&key=${API_KEY}`);
          } else {
            response = await fetch(`/api/drive-files/${latestFolder.id}`);
          }
          
          if (response.ok) {
            const data = await response.json();
            if (data.files) {
              files = data.files;
            }
          }
        } catch (error) {
          console.error("Error fetching latest images:", error);
        }
      }

      const images = files
        .filter(f => f.mimeType.startsWith('image/'))
        .map(f => {
          if (f.thumbnailLink) {
            if (f.thumbnailLink.includes('picsum.photos')) {
              return f.thumbnailLink.replace(/\/200\/200$/, '/800/600');
            }
            // Scale up thumbnail and use Google's AI smart crop (-p) to center on subjects/faces
            return f.thumbnailLink.replace(/=s\d+/, '=w1200-h800-p');
          }
          return f.webViewLink;
        })
        .slice(0, 10);

      if (images.length > 0) {
        setCarouselImages(images);
        setCurrentSlide(0);
      }
    };

    fetchLatestImages();
  }, [folders]);

  useEffect(() => {
    // Fetch from our new Express backend or directly via API key
    const fetchFolders = async () => {
      setLoading(true);
      try {
        let response;
        if (API_KEY) {
          response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name,createdTime,webViewLink)&orderBy=createdTime+desc&key=${API_KEY}`);
        } else {
          response = await fetch('/api/drive-folders');
        }
        
        if (response.status === 501) {
          setSetupRequired(true);
          // Fallback to mock data for visual demonstration
          setFolders(MOCK_FOLDERS);
          setLoading(false);
          return;
        }

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch (e) {
            // Ignore parse error
          }
          
          if (response.status === 403 || response.status === 400) {
            if (errorData?.error === 'API_DISABLED' || errorData?.error?.message?.includes('API key not valid') || errorData?.error?.message?.includes('API has not been used')) {
              setApiDisabled(true);
              setFolders(MOCK_FOLDERS);
              setLoading(false);
              return;
            }
          }
          
          if (response.status === 404) {
            if (errorData?.error === 'FOLDER_NOT_FOUND' || errorData?.error?.message?.includes('File not found')) {
              setFolderNotFound(true);
              if (errorData?.serviceAccountEmail) {
                setServiceAccountEmail(errorData.serviceAccountEmail);
              }
              setFolders(MOCK_FOLDERS);
              setLoading(false);
              return;
            } else if (!API_KEY && !errorData) {
              // If we get a 404 without JSON error data and no API key is set,
              // it means the backend is not running (e.g. static hosting).
              setSetupRequired(true);
              setFolders(MOCK_FOLDERS);
              setLoading(false);
              return;
            }
          }

          const errorMsg = errorData?.error?.message || errorData?.message || errorData?.error || 'Failed to fetch folders';
          console.error("API Error Response:", errorData);
          throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        }

        // Check if the response is actually JSON. If it's HTML, we're likely on a static host
        // that is serving index.html for the /api/drive-folders route.
        const contentType = response.headers.get('content-type');
        if (!API_KEY && contentType && contentType.includes('text/html')) {
          setSetupRequired(true);
          setFolders(MOCK_FOLDERS);
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        
        // Use real data if available, otherwise fallback to mock if empty
        if (data.files && data.files.length > 0) {
          setFolders(data.files);
        } else {
          setFolders(MOCK_FOLDERS);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching folders:", error);
        // Fallback to mock data on error so the UI doesn't look broken
        setFolders(MOCK_FOLDERS);
        setLoading(false);
      }
    };

    fetchFolders();
  }, []);

  const handleFolderClick = async (folder: DriveFolder) => {
    setSelectedFolder(folder);
    setLoadingFiles(true);

    // If it's a mock folder, skip the API call and use mock data directly
    if (MOCK_FOLDERS.some(f => f.id === folder.id)) {
      setFolderFiles(MOCK_FILES[folder.id] || MOCK_FILES['1']);
      setLoadingFiles(false);
      return;
    }

    try {
      let response;
      if (API_KEY) {
        response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folder.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink,thumbnailLink,createdTime)&orderBy=createdTime+desc&key=${API_KEY}`);
      } else {
        response = await fetch(`/api/drive-files/${folder.id}`);
      }
      
      if (!response.ok) throw new Error('Failed to fetch files');
      const data = await response.json();
      
      if (data.files && data.files.length > 0) {
        setFolderFiles(data.files);
      } else {
        // Fallback to mock data if empty (for demonstration)
        setFolderFiles(MOCK_FILES[folder.id] || MOCK_FILES['1']);
      }
    } catch (error) {
      console.error("Error fetching files:", error);
      // Fallback to mock data on error
      setFolderFiles(MOCK_FILES[folder.id] || MOCK_FILES['1']);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleDownloadFolder = async (e: React.MouseEvent, folder: DriveFolder) => {
    e.stopPropagation();
    
    setDownloadingFolderId(folder.id);
    
    try {
      // 1. Fetch files in the folder
      let files: DriveFile[] = [];
      let response;
      if (API_KEY) {
        response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folder.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink,thumbnailLink,createdTime)&orderBy=createdTime+desc&key=${API_KEY}`);
      } else {
        response = await fetch(`/api/drive-files/${folder.id}`);
      }
      
      if (response.ok) {
        const data = await response.json();
        files = data.files && data.files.length > 0 ? data.files : (MOCK_FILES[folder.id] || MOCK_FILES['1']);
      } else {
        files = MOCK_FILES[folder.id] || MOCK_FILES['1'];
      }

      const zip = new JSZip();
      const folderZip = zip.folder(folder.name);
      if (!folderZip) return;

      // 2. Download each file and add to zip
      const downloadPromises = files.map(async (file) => {
        try {
          // If it's a real file from API, we need an endpoint to download it
          let fileRes;
          if (API_KEY) {
            fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${API_KEY}`);
          } else {
            fileRes = await fetch(`/api/drive-download/${file.id}`);
          }
          
          if (fileRes.ok) {
            const blob = await fileRes.blob();
            folderZip.file(file.name, blob);
          } else {
            // Fallback for mock files or if endpoint fails
            folderZip.file(file.name, `Mock content for ${file.name}`);
          }
        } catch (err) {
          console.error(`Failed to download ${file.name}`, err);
          folderZip.file(file.name, `Mock content for ${file.name}`);
        }
      });

      await Promise.all(downloadPromises);

      // 3. Generate and save zip
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${folder.name}.zip`);
    } catch (error) {
      console.error('Error creating zip:', error);
      alert('Failed to download folder as ZIP.');
    } finally {
      setDownloadingFolderId(null);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black font-sans text-white selection:bg-white/30">
      {/* Background Image */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80"
          style={{ backgroundImage: "url('/background.jpg'), url('https://images.unsplash.com/photo-1541888086425-d81bb19240f5?q=80&w=3270&auto=format&fit=crop')" }}
        ></div>
        {/* 50% Black Overlay */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen w-full flex-col p-6 md:p-12 xl:flex-row xl:items-center xl:justify-end xl:p-24">
        
        {/* Top Titles */}
        <div className="absolute top-8 left-8 lg:top-12 lg:left-12 z-30 pointer-events-none flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Title Container (Crystal-like) */}
          <div className="inline-flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 rounded-[2rem] sm:rounded-full border border-white/20 bg-white/10 px-6 py-4 sm:px-8 sm:py-4 shadow-[0_8px_32px_rgba(255,255,255,0.1)] backdrop-blur-2xl relative overflow-hidden self-start">
            {/* Crystal Shine Effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-white/5 to-white/10 opacity-40 pointer-events-none"></div>
            <div className="absolute -top-10 -left-10 h-24 w-24 rounded-full bg-white/30 blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -right-10 h-24 w-24 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
            <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-80"></div>
            
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white relative z-10 drop-shadow-md">
              BRODERICK PROJECT
            </h2>
            <div className="hidden sm:block h-6 w-px bg-white/30 relative z-10"></div>
            <div className="flex items-center gap-2 text-sm font-medium text-white/90 relative z-10">
              <MapPin className="h-4 w-4" />
              <span>3170 Fourth Ave, San Diego, CA 92103</span>
            </div>
          </div>

          <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-6 py-4 sm:px-8 sm:py-4 shadow-[0_8px_32px_rgba(255,255,255,0.1)] backdrop-blur-2xl relative overflow-hidden self-start h-full">
            {/* Crystal Shine Effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-white/5 to-white/10 opacity-40 pointer-events-none"></div>
            <div className="absolute -top-10 -left-10 h-24 w-24 rounded-full bg-white/30 blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -right-10 h-24 w-24 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
            <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-80"></div>
            
            <h1 className="text-lg sm:text-xl font-bold uppercase tracking-widest text-white relative z-10 drop-shadow-md">
              AltitudeCAM <span className="text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse">CONNECT</span>
            </h1>
          </div>
        </div>

        {/* Logo - Bottom Left */}
        <div className="absolute bottom-8 left-8 lg:bottom-12 lg:left-12 flex flex-col opacity-90 hover:opacity-100 transition-opacity cursor-pointer z-20 select-none scale-50 origin-bottom-left">
          <div className="flex items-start text-white font-light text-4xl md:text-5xl tracking-wide leading-none">
            <span>Altitude</span>
            <div className="relative inline-flex items-center justify-center">
              <span>C</span>
              <div className="absolute h-2 w-2 md:h-2.5 md:w-2.5 bg-[#E61E25] rounded-full" style={{ left: '52%', top: '50%', transform: 'translate(-50%, -50%)' }}></div>
            </div>
            <span>AM</span>
            <span className="text-[10px] md:text-xs align-top ml-1 mt-1 font-normal text-white/80">™</span>
          </div>
          <div className="w-full flex justify-end pr-3 md:pr-4 mt-1.5">
            <span className="text-[7px] md:text-[8.5px] font-medium tracking-[0.25em] text-white">
              DIFFERENT ANGLE FILMING.
            </span>
          </div>
        </div>

        {/* Dashboards Container (Center-Right) */}
        <div className="mt-12 flex w-full flex-col gap-8 xl:mt-0 xl:w-auto relative z-10 max-w-[1800px]">
          
          {/* Dashboards Row */}
          <div className="flex flex-col xl:flex-row gap-8 w-full justify-end">
            {/* Dashboard Container 1 (Project Files) */}
            <div className="w-full flex-1 min-w-[320px] max-w-xl rounded-[2.5rem] border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-2xl lg:p-10 relative overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-2 hover:bg-black/30 hover:shadow-[0_30px_60px_-15px_rgba(255,255,255,0.1)]">
            
            {/* Subtle gradient glow inside the card */}
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/5 blur-3xl pointer-events-none"></div>

          {/* Setup Required Banner */}
          {setupRequired && (
            <div className="mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-200/90 relative z-10">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-500 mb-1">Google Drive Sync Not Configured</p>
                  <p className="text-xs">Please add your Google Service Account credentials and Folder ID to the Environment Variables to enable live syncing. Currently showing sample data.</p>
                </div>
              </div>
            </div>
          )}

          {/* API Disabled Banner */}
          {apiDisabled && (
            <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-200/90 relative z-10">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-500 mb-1">Google Drive API Error</p>
                  <p className="text-xs">The Google Drive API is either disabled for your project, or the API key is invalid. Please ensure the API is enabled in your Google Cloud Project and your key is correct.</p>
                </div>
              </div>
            </div>
          )}

          {/* Folder Not Found Banner */}
          {folderNotFound && (
            <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-200/90 relative z-10">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-500 mb-1">Folder Not Found</p>
                  <p className="text-xs mb-2">The specified Google Drive Folder ID was not found, or the Service Account email has not been granted Viewer access to it. Currently showing sample data.</p>
                  {serviceAccountEmail && (
                    <div className="bg-red-950/50 p-2 rounded border border-red-500/30 mt-2">
                      <p className="text-xs font-semibold text-red-300 mb-1">Action Required:</p>
                      <p className="text-xs text-red-200">Please share your Google Drive folder with this email address (Viewer access is sufficient):</p>
                      <code className="block mt-1 p-1.5 bg-black/40 rounded text-red-100 select-all font-mono text-xs break-all">
                        {serviceAccountEmail}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Folders Section */}
          <div className="mb-6 flex items-center justify-between relative z-10">
            <h2 className="mb-3 text-4xl font-semibold tracking-tight text-white uppercase">Project Files</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Auto-Sync</span>
              <div className="h-2 w-2 rounded-full bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
            </div>
          </div>

          {/* Folder List */}
          <div className="space-y-3 relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {loading ? (
              // Loading Skeletons
              Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex h-[88px] animate-pulse items-center rounded-2xl bg-white/5 p-4 border border-white/5">
                  <div className="h-12 w-12 rounded-xl bg-white/10"></div>
                  <div className="ml-4 flex-1 space-y-3">
                    <div className="h-4 w-3/4 rounded-md bg-white/10"></div>
                    <div className="h-3 w-1/2 rounded-md bg-white/5"></div>
                  </div>
                </div>
              ))
            ) : (
              folders.slice(0, 7).map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => handleFolderClick(folder)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleFolderClick(folder);
                    }
                  }}
                  className="w-full text-left group flex items-center rounded-2xl border border-white/5 bg-white/5 p-4 transition-all duration-300 hover:bg-white/10 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:border-white/10 cursor-pointer"
                >
                  {/* Icon */}
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/10 to-white/5 shadow-inner border border-white/10 group-hover:from-white/20 group-hover:to-white/10 transition-colors">
                    <Folder className="h-5 w-5 text-white/80 group-hover:text-white" />
                  </div>

                  {/* Details */}
                  <div className="ml-4 flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-medium text-white/90 group-hover:text-white transition-colors">
                        {folder.name}
                      </h3>
                      {isNew(folder.createdTime) && (
                        <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                          New
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-white/50 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 opacity-70" />
                        {new Date(folder.createdTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <File className="h-3.5 w-3.5 opacity-70" />
                        {folder.itemCount} items
                      </span>
                    </div>
                  </div>

                  {/* Download Button */}
                  <button
                    onClick={(e) => handleDownloadFolder(e, folder)}
                    disabled={downloadingFolderId === folder.id}
                    className="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/5 hover:bg-white/20 transition-colors border border-white/10 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Download Folder as ZIP"
                  >
                    {downloadingFolderId === folder.id ? (
                      <Loader2 className="h-4 w-4 text-white/70 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 text-white/70 hover:text-white transition-colors" />
                    )}
                  </button>

                  {/* Chevron */}
                  <div className="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/0 transition-colors group-hover:bg-white/10">
                    <ChevronRight className="h-4 w-4 text-white/40 group-hover:text-white/90 transition-colors" />
                  </div>
                </div>
              ))
            )}
          </div>
          
          </div>

          {/* Dashboard Container 2 (Slideshow Carousel) */}
          <div className="w-full flex-1 min-w-[320px] max-w-xl rounded-[2.5rem] border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-2xl lg:p-10 relative overflow-hidden flex flex-col">
            <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-white/5 blur-3xl pointer-events-none"></div>
            
            <div className="mb-10 relative z-10">
              <h2 className="mb-3 text-4xl font-semibold tracking-tight text-white">
                GALLERY
              </h2>
              <div className="flex items-center gap-2 text-sm font-medium text-white/60">
                <ImageIcon className="h-4 w-4" />
                <span>Latest Site Photos</span>
              </div>
            </div>

            <div className="relative flex-1 min-h-[300px] w-full rounded-2xl overflow-hidden group border border-white/10">
              {carouselImages.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Slide ${idx + 1}`}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                />
              ))}
              
              {/* Controls */}
              <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button onClick={prevSlide} className="p-2 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition-colors border border-white/10">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={nextSlide} className="p-2 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition-colors border border-white/10">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              
              {/* Indicators */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                {carouselImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'bg-white w-6' : 'bg-white/40 w-1.5 hover:bg-white/60'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Dashboard Container 3 (Video) */}
          <div className="w-full flex-1 min-w-[320px] max-w-xl rounded-[2.5rem] border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-2xl lg:p-10 relative overflow-hidden flex flex-col">
            <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-white/5 blur-3xl pointer-events-none"></div>
            
            <div className="mb-10 relative z-10">
              <h2 className="mb-3 text-4xl font-semibold tracking-tight text-white">
                VIDEO
              </h2>
              <div className="flex items-center gap-2 text-sm font-medium text-white/60">
                <Video className="h-4 w-4" />
                <span>Live Feed / Timelapse</span>
              </div>
            </div>

            <div className="relative flex-1 min-h-[300px] w-full rounded-2xl overflow-hidden border border-white/10 aspect-video bg-black/50">
              <iframe
                src="https://player.vimeo.com/video/1179125476?title=0&byline=0&portrait=0&autoplay=1&muted=1&loop=1"
                className="absolute top-0 left-0 w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>

          </div>

        </div>
      </div>

      {/* Folder Contents Modal */}
      {selectedFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
            onClick={() => setSelectedFolder(null)}
          ></div>
          <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-[2rem] border border-white/10 bg-[#111]/90 shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 p-6 sm:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <Folder className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{selectedFolder.name}</h3>
                  <p className="text-xs text-white/50">{folderFiles.length} items</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedFolder(null)}
                className="rounded-full bg-white/5 p-2 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
              {loadingFiles ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col animate-pulse items-center rounded-2xl bg-white/5 p-4 border border-white/5">
                      <div className="h-32 w-32 rounded-2xl bg-white/10 mb-4"></div>
                      <div className="w-full space-y-2 flex flex-col items-center">
                        <div className="h-3 w-3/4 rounded bg-white/10"></div>
                        <div className="h-2 w-1/2 rounded bg-white/5"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : folderFiles.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {folderFiles.map((file) => (
                    <a
                      key={file.id}
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col items-center rounded-2xl border border-white/5 bg-white/5 p-4 transition-all duration-300 hover:bg-white/10 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:border-white/10 text-center"
                    >
                      <div className="flex h-32 w-32 flex-shrink-0 items-center justify-center rounded-2xl bg-black/50 border border-white/5 group-hover:bg-black/70 overflow-hidden mb-4 relative">
                        {file.thumbnailLink ? (
                          <img src={file.thumbnailLink.replace(/=s\d+/, '=w400-h400-p')} alt={file.name} className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                        ) : (
                          getFileIcon(file.mimeType, "h-12 w-12")
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ExternalLink className="h-8 w-8 text-white drop-shadow-lg" />
                        </div>
                      </div>
                      <div className="w-full overflow-hidden">
                        <h4 className="truncate text-sm font-medium text-white/90 group-hover:text-white">
                          {file.name}
                        </h4>
                        <p className="mt-1 text-[10px] text-white/40 uppercase tracking-wider">
                          {new Date(file.createdTime).toLocaleDateString()}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-4">
                    <File className="h-8 w-8 text-white/20" />
                  </div>
                  <p className="text-white/60 font-medium">This folder is empty</p>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="border-t border-white/10 bg-black/20 p-4 sm:px-8 flex justify-end">
              <a 
                href={selectedFolder.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
              >
                <span>Open Folder in Drive</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Developer Notes Modal */}
      {showDevNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDevNotes(false)}
          ></div>
          <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#111] p-8 shadow-2xl overflow-hidden">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Google Drive Integration Guide</h3>
              <button 
                onClick={() => setShowDevNotes(false)}
                className="rounded-full bg-white/10 p-2 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6 text-sm text-white/70">
              <div>
                <h4 className="text-base font-medium text-white mb-2">Option 1: Serverless API (Recommended)</h4>
                <p className="mb-2">For a seamless, invisible integration without third-party branding:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Create a Google Cloud Project and enable the <strong>Google Drive API</strong>.</li>
                  <li>Create a <strong>Service Account</strong> and share your specific Drive folder with its email address.</li>
                  <li>Set up a serverless function (e.g., Vercel Serverless Functions or Next.js API route) that uses the <code>googleapis</code> npm package.</li>
                  <li>The function authenticates using the Service Account credentials and calls <code>drive.files.list</code> filtering by the parent folder ID.</li>
                  <li>The frontend fetches this API route on load, ensuring credentials are never exposed to the client.</li>
                </ol>
              </div>

              <div className="h-px w-full bg-white/10"></div>

              <div>
                <h4 className="text-base font-medium text-white mb-2">Option 2: Third-Party Widget (No-Code)</h4>
                <p className="mb-2">If you prefer not to write backend code, you can use a widget provider:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Elfsight Google Drive Widget:</strong> Connect your Google account in their dashboard, select the folder, and embed their provided <code>&lt;script&gt;</code> tag into this React component.</li>
                  <li><strong>Common Ninja:</strong> Similar to Elfsight, offers a customizable Drive folder embed.</li>
                  <li><em>Note:</em> Widgets often come with their own styling which may conflict with this Apple-inspired aesthetic unless heavily customized via CSS.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
