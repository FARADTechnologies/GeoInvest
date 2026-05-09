import os
import psycopg2

# 1. BAĞLANTI AYARLARI
conn = psycopg2.connect(
    host=os.environ["SOURCE_DB_HOST"],
    port=os.environ.get("SOURCE_DB_PORT", "5432"),
    user=os.environ["SOURCE_DB_USER"],
    password=os.environ["SOURCE_DB_PASSWORD"],
    dbname=os.environ.get("SOURCE_DB_NAME", "source_dev_db"),
)
imlec = conn.cursor()

print("--- ANALİZ BAŞLADI ---")

# 2. H6, H7 VE H8 SEVİYELERİ İÇİN DÖNGÜ
for res in [6, 7, 8]:
    print(f"\nSeviye {res} hesaplanıyor...") # Terminale hangi aşamada olduğumuzu yazar
    
    sorgu = f"""
        SELECT 
            h3_lat_lng_to_cell(point(longitude, latitude), {res})::text,
            COUNT(*),
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY owner_price)
        FROM item_app_items
        WHERE latitude IS NOT NULL
        GROUP BY 1
        ORDER BY 2 DESC -- En çok ilan olanı en üste koy
        LIMIT 3;         -- Terminal kalabalık olmasın diye sadece en yoğun 3 bölgeyi göster
    """
    
    imlec.execute(sorgu)
    satirlar = imlec.fetchall()
    
    # 3. TERMİNALE YAZDIRMA (Serial Monitor gibi)
    for satir in satirlar:
        # satir[0] = Altıgen ID, satir[1] = Sayı, satir[2] = Medyan Fiyat
        print(f"Bölge: {satir[0]} | İlan Sayısı: {satir[1]} | Medyan Fiyat: {satir[2]} AZN")

print("\n--- ANALİZ TAMAMLANDI ---")
conn.close()