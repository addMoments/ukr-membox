import { t } from '../packages/i18n';
import '../v2-styles/GalleryFilterBar.css';

const iconMap: Record<string, string> = {
  image: 'fa-solid fa-image',
  video: 'fa-solid fa-video',
  heart: 'fa-solid fa-heart',
};

type FilterTab = {
  key: string;
  labelKey: string;
  icon?: string;
};

interface GalleryFilterBarProps {
  tabs?: FilterTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  searchPlaceholder?: string;
  renderSearch?: boolean;
  sortOrder?: 'desc' | 'asc';
  onSortChange?: (order: 'desc' | 'asc') => void;
}

const defaultTabs: FilterTab[] = [
  { key: 'all', labelKey: 'gallery.filterAllMedia', icon: '' },
  { key: 'photos', labelKey: 'gallery.filterPhotos', icon: 'image' },
  { key: 'videos', labelKey: 'gallery.filterVideos', icon: 'video' },
];

function GalleryFilterBar({
  tabs = defaultTabs,
  activeTab,
  onTabChange,
  searchPlaceholder,
  renderSearch = true,
  sortOrder = 'desc',
  onSortChange,
}: GalleryFilterBarProps) {
  return (
    <div className="gallery-filter-bar">
      <div className="gallery-filter-inner">
        <div className="gallery-filter-tabs">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              className={`gallery-filter-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.icon && iconMap[tab.icon] && <i className={iconMap[tab.icon]}></i>}
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <div className="gallery-filter-search-row">
          {renderSearch && <div className="gallery-search-wrapper">
            <i className="fa-solid fa-search gallery-search-icon"></i>
            <input
              type="text"
              className="gallery-search-input"
              placeholder={searchPlaceholder || t('gallery.searchPlaceholder')}
            />
          </div>}
          <button
            className="gallery-sort-btn"
            style={!renderSearch ? { marginLeft: 'auto' } : undefined}
            onClick={() => onSortChange?.(sortOrder === 'desc' ? 'asc' : 'desc')}
          >
            <i className={`fa-solid fa-arrow-${sortOrder === 'desc' ? 'down' : 'up'}-wide-short`}></i>
            <span>{sortOrder === 'desc' ? t('gallery.sortNewest') : t('gallery.sortOldest')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default GalleryFilterBar;
