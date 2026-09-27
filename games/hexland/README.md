# ⚔️ Hexland (Web & GitHub Pages)

Tamamen **ücretsiz**, sunucusuz ve saf web teknolojileri (HTML5 Canvas + Vanilla JavaScript + CSS3) ile geliştirilmiş retro 8-bit / 16-bit **Hexland** oyunu.

---

## 🎮 Özellikler

- **%100 Ücretsiz & Statik:** Harici bir arka uç (backend) veya veritabanı gerektirmez. GitHub Pages üzerinde sıfır maliyetle çalışır.
- **Tüm Hexland Kuralları:**
  - 19 karolu rastgele ada üretimi & zar pulları (6 ve 8 kırmızı vurgulu).
  - Yılan sırası başlangıç yerleşimi (Snake draft).
  - Yol, Köy (1 VP) ve Şehir (2 VP) inşaatı.
  - Hırsız mekaniği (7 geldiğinde kart atma, hırsızı taşıma, kart çalma).
  - Banka ve 9 adet kıyı limanı (3:1 genel, 2:1 özel kaynak limanları).
  - Gelişim Kartları (Şövalye, Bereket Yılı, Tekel, Yol İnşası, Zafer Puanı).
  - En Uzun Yol (2 VP) ve En Büyük Ordu (2 VP) ödülleri.
  - 10 Zafer Puanına ilk ulaşan kazanır.
- **8-Bit Retro Ses Motoru:** Web Audio API ile sıfır harici ses dosyasıyla çalışan nostaljik ses efektleri (zar atma, inşaat, hasat, hırsız ve zafer melodisi).
- **Akıllı Bot Yapay Zekası:** Tek başınıza pratik yapabilmeniz için 3 akıllı bot rakip (yerleşim stratejileri, liman takası ve hırsız hamleleri).

---

## 🎨 Aseprite ile Kendi Çizimlerinizi Ekleme

Oyun varsayılan olarak dahili piksel çizimleriyle (procedural fallback) hemen oynanabilir durumdadır. Aseprite üzerinden kendi çizimlerinizi eklemek istediğinizde:

1. Aseprite'ta çiziminizi yapın (Önerilen boyut: **32x32** veya **48x48** piksel, şeffaf / transparent arkaplan).
2. PNG olarak export edip `assets/images/` klasörüne şu isimlerle kaydedin:
   - `hex_forest.png` (Orman / Odun)
   - `hex_hills.png` (Tepe / Tuğla)
   - `hex_pasture.png` (Çayır / Yün)
   - `hex_fields.png` (Tarla / Buğday)
   - `hex_mountains.png` (Dağ / Cevher)
   - `hex_desert.png` (Çöl)
   - `robber.png` (Hırsız)
   - `settlement.png` (Köy)
   - `city.png` (Şehir)
3. Sayfayı yenilediğinizde oyun otomatik olarak kendi çizimlerinizi yükleyip gösterecektir!

---

## 🚀 GitHub Pages ile Yayına Alma (2 Adımda Ücretsiz)

1. **GitHub'da Repo Oluşturun:**
   - [github.com](https://github.com) üzerinde `hexland` adında yeni bir Public repo açın.
   - Bu klasördeki tüm dosyaları o repoya yükleyin (`git push`).
2. **GitHub Pages'i Açın:**
   - GitHub'da reponuzun **Settings** sekmesine tıklayın.
   - Sol menüden **Pages** seçeneğine gelin.
   - **Branch** kısmından `main` (veya `master`) ve `/ (root)` seçip **Save** butonuna basın.
   - 1-2 dakika içinde oyununuz `https://<kullanici-adiniz>.github.io/hexland/` adresinde tüm dünyadan oynanabilir olacaktır!

---

## 💻 Bilgisayarınızda Yerel Olarak Çalıştırma

ES modülleri (ES6 Modules) kullandığı için basit bir yerel HTTP sunucusuyla çalıştırmak yeterlidir:

**Python ile:**
```bash
python -m http.server 8000
```
Ardından tarayıcınızda `http://localhost:8000` adresini açın.

**VS Code ile:**
- `Live Server` eklentisi ile `index.html` üzerinde sağ tıklayıp "Open with Live Server" demeniz yeterlidir.
