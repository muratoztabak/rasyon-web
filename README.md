# Topaloğlu Rasyon Programı — yayınlanan sürüm

Bu depo **derlenmiş çıktıdır**, kaynak kod değildir. Kaynak ayrı ve gizli bir
depoda durur; buraya yalnızca tarayıcının indirdiği dosyalar konur.

Adres: https://muratoztabak.github.io/rasyon-web/

## Buradaki dosyalar ne

| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Programın kabuğu |
| `assets/` | Derlenmiş JavaScript ve stil dosyaları |
| `sw.js` | Servis çalışanı — program internetsiz de açılsın diye |
| `manifest.webmanifest` | Ana ekrana eklenince tam ekran açılması için |
| `ikon-*.png`, `favicon.png` | Simgeler |
| `.nojekyll` | GitHub Pages dosyaları olduğu gibi servis etsin diye |

## İçindeki Supabase adresi ve anahtarı

`assets/` içindeki betikte projenin adresi ve **genel (publishable) anahtarı**
görünür. Bu tasarım gereğidir: o anahtar herkese açıktır ve öyle olması
gerekir. Veriyi koruyan şey anahtar değil, veritabanındaki satır düzeyi
güvenlik kurallarıdır — her kullanıcı yalnızca kendi satırını okur ve yazar.

Gizli (`service_role` / `secret`) anahtar buraya **hiçbir koşulda girmez**.

## Güncelleme

Kaynak depoda `npm run build` çalıştırılıp bu deponun içeriği yenilenir.
