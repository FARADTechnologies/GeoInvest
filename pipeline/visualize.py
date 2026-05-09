import streamlit as st
import pandas as pd
import folium
from streamlit_folium import st_folium
import h3
import branca.colormap as cm
import json
import os

# --- PAGE CONFIG ---
st.set_page_config(
    page_title="H3 Spatial Emlak Analiz Sistemi",
    page_icon="🏘️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- PREMIUM CSS (Glassmorphism & Dark Mode) ---
st.markdown("""
<style>
    /* Main Background */
    .stApp {
        background-color: #0e1117;
        color: #fafafa;
    }
    
    /* Sidebar Styling */
    section[data-testid="stSidebar"] {
        background-color: rgba(25, 28, 36, 0.9);
        backdrop-filter: blur(10px);
        border-right: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    /* Premium Metric Cards */
    .metric-card {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(10px);
        border-radius: 15px;
        padding: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: transform 0.3s ease;
    }
    .metric-card:hover {
        transform: translateY(-5px);
        background: rgba(255, 255, 255, 0.08);
    }
    .metric-label {
        font-size: 0.9rem;
        color: #888;
        margin-bottom: 5px;
    }
    .metric-value {
        font-size: 1.8rem;
        font-weight: 700;
        color: #fff;
    }
    .metric-trend {
        font-size: 0.8rem;
        margin-top: 5px;
    }
    .trend-up { color: #00ff88; }
    .trend-down { color: #ff4b4b; }
    
    /* Custom Headers */
    .premium-header {
        font-family: 'Inter', sans-serif;
        font-weight: 800;
        background: linear-gradient(90deg, #fff, #888);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 2rem;
    }
</style>
""", unsafe_allow_html=True)

class H3Visualizer:
    def __init__(self):
        self.data_path = "data/h3_analysis_results.csv"
        self.json_path = "index_app_object.json"
        
    @st.cache_data
    def load_analysis_data(_self):
        if not os.path.exists(_self.data_path):
            return None
        df = pd.read_csv(_self.data_path)
        df['period'] = df['period'].astype(str)
        return df

    @st.cache_data
    def load_regions_json(_self):
        if not os.path.exists(_self.json_path):
            return None
        with open(_self.json_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def render_sidebar(self, df):
        st.sidebar.markdown("<h2 style='text-align: center;'>⚙️ Kontrol Paneli</h2>", unsafe_allow_html=True)
        
        # 1. Analysis Mode
        st.sidebar.subheader("Analiz Modu")
        analysis_mode = st.sidebar.radio(
            "Seçim Yapın",
            ["GEOM Tabanlı (Rayon)", "H3-Pure (Global Grid)"],
            help="GEOM: İdari sınırlara göre analiz. H3-Pure: Sınır tanımayan global altıgen analiz."
        )
        mode_key = 'geom' if "GEOM" in analysis_mode else 'pure_h3'
        
        # 2. Period Selection
        periods = sorted(df['period'].unique(), reverse=True)
        selected_period = st.sidebar.selectbox("Analiz Dönemi", periods)
        
        # 3. Category Comparison
        categories = sorted(df['category'].unique())
        selected_cats = st.sidebar.multiselect("Kategoriler (Kıyaslama için)", categories, default=categories)
        
        # 4. Resolution Slider
        res_options = sorted(df['resolution'].unique())
        selected_res = st.sidebar.select_slider("H3 Çözünürlüğü", options=res_options, value=7)
        
        st.sidebar.markdown("---")
        show_boundaries = st.sidebar.toggle("Rayon Sınırlarını Çiz", value=True) if mode_key == 'geom' else False
        
        return {
            "mode": mode_key,
            "period": selected_period,
            "categories": selected_cats,
            "resolution": selected_res,
            "show_boundaries": show_boundaries
        }

    def render_metrics(self, df, filters):
        # Filter data for current period and mode
        current_data = df[
            (df['analysis_type'] == filters['mode']) & 
            (df['period'] == filters['period']) &
            (df['category'].isin(filters['categories'])) &
            (df['resolution'] == filters['resolution'])
        ]
        
        # Calculate totals
        total_ads = current_data['ad_count'].sum()
        avg_median_price = current_data['median_price_kvm'].median() if not current_data.empty else 0
        
        # Trend calculation (compared to previous month)
        periods = sorted(df['period'].unique())
        prev_period = None
        try:
            curr_idx = periods.index(filters['period'])
            if curr_idx < len(periods) - 1:
                prev_period = periods[curr_idx + 1] # Period list is descending in logic if I sorted it
        except: pass
        
        trend_val = 0
        if prev_period:
            prev_data = df[
                (df['analysis_type'] == filters['mode']) & 
                (df['period'] == prev_period) &
                (df['category'].isin(filters['categories'])) &
                (df['resolution'] == filters['resolution'])
            ]
            prev_median = prev_data['median_price_kvm'].median() if not prev_data.empty else 0
            if prev_median > 0:
                trend_val = ((avg_median_price - prev_median) / prev_median) * 100

        cols = st.columns(3)
        with cols[0]:
            st.markdown(f"""
                <div class="metric-card">
                    <div class="metric-label">Toplam İlan Sayısı</div>
                    <div class="metric-value">{total_ads:,}</div>
                </div>
            """, unsafe_allow_html=True)
        with cols[1]:
            trend_class = "trend-up" if trend_val >= 0 else "trend-down"
            trend_arrow = "▲" if trend_val >= 0 else "▼"
            st.markdown(f"""
                <div class="metric-card">
                    <div class="metric-label">Ortalama Median Fiyat (m²)</div>
                    <div class="metric-value">{avg_median_price:,.0f} AZN</div>
                    <div class="metric-trend {trend_class}">{trend_arrow} {abs(trend_val):.1f}% vs Önceki Ay</div>
                </div>
            """, unsafe_allow_html=True)
        with cols[2]:
            unique_areas = len(current_data['h3_index'].unique())
            st.markdown(f"""
                <div class="metric-card">
                    <div class="metric-label">Aktif H3 Hücresi</div>
                    <div class="metric-value">{unique_areas}</div>
                </div>
            """, unsafe_allow_html=True)

    def create_map(self, df, regions_json, filters):
        # Center of Baku
        m = folium.Map(location=[40.4093, 49.8671], zoom_start=11, tiles="CartoDB dark_matter")
        
        # Filter data for map
        map_data = df[
            (df['analysis_type'] == filters['mode']) & 
            (df['period'] == filters['period']) &
            (df['category'].isin(filters['categories'])) &
            (df['resolution'] == filters['resolution'])
        ]
        
        if map_data.empty:
            st.warning("Seçili kriterlere uygun veri bulunamadı.")
            return m

        # Aggregate if multiple categories selected
        agg_map = map_data.groupby('h3_index').agg({
            'ad_count': 'sum',
            'median_price_kvm': 'median',
            'rayon_name': lambda x: ", ".join(x.unique()),
            'category': lambda x: ", ".join(x.unique())
        }).reset_index()

        # Colormap
        min_p = agg_map['median_price_kvm'].min()
        max_p = agg_map['median_price_kvm'].max()
        colormap = cm.LinearColormap(
            colors=['#00ff88', '#ffff00', '#ff4b4b'], 
            vmin=min_p, vmax=max_p
        ).to_step(n=10)
        colormap.caption = "Median Qiymət (AZN/m²)"
        m.add_child(colormap)

        # Draw H3 Cells
        for _, row in agg_map.iterrows():
            hex_id = row['h3_index']
            boundary = h3.cell_to_boundary(hex_id)
            polygon = [list(coord) for coord in boundary]
            
            tooltip_html = f"""
            <div style='font-family: sans-serif; min-width: 180px; padding: 10px; background: #1a1c24; color: white; border-radius: 8px;'>
                <h4 style='margin: 0 0 5px 0; color: #00ff88;'>{row['rayon_name']}</h4>
                <div style='font-size: 0.85rem; opacity: 0.8;'>{row['category']}</div>
                <hr style='border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 8px 0;'>
                <table style='width: 100%; font-size: 0.9rem;'>
                    <tr><td>İlan:</td><td style='text-align:right;'><b>{int(row['ad_count'])}</b></td></tr>
                    <tr><td>Fiyat/m²:</td><td style='text-align:right;'><b style='color:#ffcc00;'>{row['median_price_kvm']:.0f} AZN</b></td></tr>
                </table>
            </div>
            """
            
            folium.Polygon(
                locations=polygon,
                fill=True,
                fill_color=colormap(row['median_price_kvm']),
                fill_opacity=0.6,
                color='white',
                weight=0.5,
                tooltip=tooltip_html
            ).add_to(m)

        # Draw Rayon Boundaries if enabled
        if filters.get('show_boundaries') and regions_json:
            # Convert list of objects to FeatureCollection
            features = []
            for item in regions_json:
                if 'geojson' in item:
                    features.append({
                        "type": "Feature",
                        "geometry": item['geojson'],
                        "properties": {"name": item.get('name', 'Bilinmir')}
                    })
            
            feature_collection = {
                "type": "FeatureCollection",
                "features": features
            }

            folium.GeoJson(
                feature_collection,
                name="Rayon Sınırları",
                style_function=lambda x: {
                    'fillColor': 'transparent',
                    'color': '#ffffff',
                    'weight': 2,
                    'dashArray': '5, 5'
                },
                tooltip=folium.GeoJsonTooltip(fields=['name'], aliases=['Rayon:'])
            ).add_to(m)

        return m

    def run(self):
        st.markdown("<h1 class='premium-header'>🏘️ H3 Mekansal Emlak Analiz Sistemi</h1>", unsafe_allow_html=True)
        
        df = self.load_analysis_data()
        regions_json = self.load_regions_json()
        
        if df is None:
            st.error("Veri dosyası bulunamadı. Lütfen analiz scriptini çalıştırın.")
            return

        filters = self.render_sidebar(df)
        
        # Main Layout
        self.render_metrics(df, filters)
        st.markdown("<br>", unsafe_allow_html=True)
        
        m = self.create_map(df, regions_json, filters)
        st_folium(m, width=None, height=700, use_container_width=True, key="main_map")

if __name__ == "__main__":
    app = H3Visualizer()
    app.run()
