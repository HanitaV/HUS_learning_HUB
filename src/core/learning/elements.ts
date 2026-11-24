export interface PeriodicElement {
  readonly atomicNumber: number;
  readonly symbol: string;
  readonly nameVi: string;
  readonly nameEn: string;
  readonly shells: readonly number[];
  readonly funFact: string;
}

/**
 * Ground-state electron shell configurations for real chemical elements (Z = 1..36).
 * Pure reference data used to recognize when a course's chapter/lesson structure
 * naturally matches a real-life atom's electron shells.
 */
export const PERIODIC_ELEMENTS: readonly PeriodicElement[] = [
  {
    atomicNumber: 1,
    symbol: 'H',
    nameVi: 'Hiđrô',
    nameEn: 'Hydrogen',
    shells: [1],
    funFact:
      'Nguyên tố nhẹ nhất và phổ biến nhất vũ trụ, chiếm khoảng 75% khối lượng vật chất thường và là nhiên liệu thắp sáng mọi ngôi sao.',
  },
  {
    atomicNumber: 2,
    symbol: 'He',
    nameVi: 'Heli',
    nameEn: 'Helium',
    shells: [2],
    funFact:
      'Được phát hiện lần đầu trong quang phổ Mặt Trời năm 1868 trước khi tìm thấy trên Trái Đất; là nguyên tố duy nhất không hóa rắn ở áp suất thường.',
  },
  {
    atomicNumber: 3,
    symbol: 'Li',
    nameVi: 'Liti',
    nameEn: 'Lithium',
    shells: [2, 1],
    funFact:
      'Kim loại nhẹ nhất trong bảng tuần hoàn — nhẹ hơn cả nước và nổi trên mặt dầu, là trái tim của pin lithium-ion hiện đại.',
  },
  {
    atomicNumber: 4,
    symbol: 'Be',
    nameVi: 'Beri',
    nameEn: 'Beryllium',
    shells: [2, 2],
    funFact:
      'Gương chính bằng beri mạ vàng của kính thiên văn không gian James Webb giữ nguyên độ chính xác hình học ở nhiệt độ lạnh sâu ngoài vũ trụ.',
  },
  {
    atomicNumber: 5,
    symbol: 'B',
    nameVi: 'Bo',
    nameEn: 'Boron',
    shells: [2, 3],
    funFact:
      'Tạo nên thủy tinh borosilicat chịu sốc nhiệt trong phòng thí nghiệm khoa học và giúp giữ ổn định cấu trúc vách tế bào thực vật.',
  },
  {
    atomicNumber: 6,
    symbol: 'C',
    nameVi: 'Cacbon',
    nameEn: 'Carbon',
    shells: [2, 4],
    funFact:
      'Chỉ từ cùng một nguyên tử cacbon, sự sắp xếp liên kết khác nhau tạo nên cả than chì mềm lẫn kim cương cứng bậc nhất tự nhiên.',
  },
  {
    atomicNumber: 7,
    symbol: 'N',
    nameVi: 'Nitơ',
    nameEn: 'Nitrogen',
    shells: [2, 5],
    funFact:
      'Chiếm khoảng 78% khí quyển Trái Đất; ở dạng lỏng (−196 °C), nitơ được dùng để làm lạnh siêu dẫn và bảo quản mẫu sinh học.',
  },
  {
    atomicNumber: 8,
    symbol: 'O',
    nameVi: 'Oxi',
    nameEn: 'Oxygen',
    shells: [2, 6],
    funFact:
      'Oxi lỏng có màu xanh lam nhạt và có tính thuận từ — nó có thể bị hút lơ lửng giữa hai cực của một nam châm mạnh.',
  },
  {
    atomicNumber: 9,
    symbol: 'F',
    nameVi: 'Flo',
    nameEn: 'Fluorine',
    shells: [2, 7],
    funFact:
      'Nguyên tố có độ âm điện lớn nhất bảng tuần hoàn, phản ứng mạnh đến mức có thể tạo hợp chất ngay cả với một số khí hiếm.',
  },
  {
    atomicNumber: 10,
    symbol: 'Ne',
    nameVi: 'Neon',
    nameEn: 'Neon',
    shells: [2, 8],
    funFact:
      'Phát ra ánh sáng đỏ cam rực rỡ khi có dòng điện cao áp đi qua trong ống phóng điện và gần như trơ hoàn toàn về mặt hóa học.',
  },
  {
    atomicNumber: 11,
    symbol: 'Na',
    nameVi: 'Natri',
    nameEn: 'Sodium',
    shells: [2, 8, 1],
    funFact:
      'Mềm đến mức cắt được bằng dao và tạo vạch phát xạ vàng kép đặc trưng ở bước sóng 589 nm trong quang phổ học.',
  },
  {
    atomicNumber: 12,
    symbol: 'Mg',
    nameVi: 'Magiê',
    nameEn: 'Magnesium',
    shells: [2, 8, 2],
    funFact:
      'Nằm ngay tại tâm phân tử diệp lục (chlorophyll), giúp thực vật hấp thụ ánh sáng Mặt Trời để quang hợp.',
  },
  {
    atomicNumber: 13,
    symbol: 'Al',
    nameVi: 'Nhôm',
    nameEn: 'Aluminium',
    shells: [2, 8, 3],
    funFact:
      'Kim loại phổ biến nhất trong vỏ Trái Đất; thế kỷ 19 từng quý hơn cả vàng trước khi phát minh ra phương pháp điện phân nóng chảy.',
  },
  {
    atomicNumber: 14,
    symbol: 'Si',
    nameVi: 'Silic',
    nameEn: 'Silicon',
    shells: [2, 8, 4],
    funFact:
      'Nền tảng của toàn bộ ngành vi mạch bán dẫn và pin mặt trời, đồng thời chiếm hơn 27% khối lượng vỏ Trái Đất.',
  },
  {
    atomicNumber: 15,
    symbol: 'P',
    nameVi: 'Photpho',
    nameEn: 'Phosphorus',
    shells: [2, 8, 5],
    funFact:
      'Tên gọi bắt nguồn từ tiếng Hy Lạp nghĩa là “người mang ánh sáng” vì khả năng phát quang trong bóng tối; là mắt xích cốt lõi của DNA và ATP.',
  },
  {
    atomicNumber: 16,
    symbol: 'S',
    nameVi: 'Lưu huỳnh',
    nameEn: 'Sulfur',
    shells: [2, 8, 6],
    funFact:
      'Xuất hiện rực rỡ quanh miệng núi lửa và tạo nên màu vàng đặc trưng trên bề mặt vệ tinh Io của Sao Mộc.',
  },
  {
    atomicNumber: 17,
    symbol: 'Cl',
    nameVi: 'Clo',
    nameEn: 'Chlorine',
    shells: [2, 8, 7],
    funFact:
      'Dù là khí độc ở dạng đơn chất, khi kết hợp với natri lại tạo thành muối ăn NaCl thiết yếu cho sự sống.',
  },
  {
    atomicNumber: 18,
    symbol: 'Ar',
    nameVi: 'Argon',
    nameEn: 'Argon',
    shells: [2, 8, 8],
    funFact:
      'Khí hiếm phổ biến nhất trong khí quyển Trái Đất (~0,93%), được bơm vào bóng đèn và khung cửa kính cách nhiệt nhờ tính trơ tuyệt đối.',
  },
  {
    atomicNumber: 19,
    symbol: 'K',
    nameVi: 'Kali',
    nameEn: 'Potassium',
    shells: [2, 8, 8, 1],
    funFact:
      'Cháy với ngọn lửa màu tím hoa cà dịu mắt và đóng vai trò dẫn truyền xung điện trong mọi tế bào thần kinh.',
  },
  {
    atomicNumber: 20,
    symbol: 'Ca',
    nameVi: 'Canxi',
    nameEn: 'Calcium',
    shells: [2, 8, 8, 2],
    funFact:
      'Không chỉ cấu tạo nên xương và vỏ sinh vật biển, canxi còn là thành phần tạo nên các dãy núi đá vôi và thạch nhũ kỳ vĩ.',
  },
  {
    atomicNumber: 21,
    symbol: 'Sc',
    nameVi: 'Scandi',
    nameEn: 'Scandium',
    shells: [2, 8, 9, 2],
    funFact:
      'Được Mendeleev tiên đoán chính xác tính chất từ trước khi phát hiện 10 năm dưới tên gọi “eka-boron”.',
  },
  {
    atomicNumber: 22,
    symbol: 'Ti',
    nameVi: 'Titan',
    nameEn: 'Titanium',
    shells: [2, 8, 10, 2],
    funFact:
      'Bền ngang thép nhưng nhẹ hơn tới 45% và tương thích sinh học cao, được dùng từ vỏ tàu vũ trụ đến khớp nhân tạo.',
  },
  {
    atomicNumber: 23,
    symbol: 'V',
    nameVi: 'Vanadi',
    nameEn: 'Vanadium',
    shells: [2, 8, 11, 2],
    funFact:
      'Các trạng thái oxi hóa khác nhau của vanadi trong dung dịch tạo nên bốn sắc màu rực rỡ: tím, xanh lam, xanh lục và vàng.',
  },
  {
    atomicNumber: 24,
    symbol: 'Cr',
    nameVi: 'Crom',
    nameEn: 'Chromium',
    shells: [2, 8, 13, 1],
    funFact:
      'Một lượng vết cực nhỏ ion crom là bí mật tạo nên sắc đỏ rực của hồng ngọc (ruby) và sắc xanh lục bảo của ngọc lục bảo (emerald).',
  },
  {
    atomicNumber: 25,
    symbol: 'Mn',
    nameVi: 'Mangan',
    nameEn: 'Manganese',
    shells: [2, 8, 13, 2],
    funFact:
      'Không thể thiếu để luyện thép chịu mài mòn và giúp giải phóng oxi trong quá trình quang hợp của thực vật.',
  },
  {
    atomicNumber: 26,
    symbol: 'Fe',
    nameVi: 'Sắt',
    nameEn: 'Iron',
    shells: [2, 8, 14, 2],
    funFact:
      'Hạt nhân sắt-56 có năng lượng liên kết riêng cao bậc nhất, đánh dấu điểm dừng của phản ứng nhiệt hạch trong lõi các ngôi sao khổng lồ.',
  },
  {
    atomicNumber: 27,
    symbol: 'Co',
    nameVi: 'Coban',
    nameEn: 'Cobalt',
    shells: [2, 8, 15, 2],
    funFact:
      'Tạo nên sắc xanh coban huyền thoại trên đồ gốm sứ cổ và là nguyên tử trung tâm của vitamin B12.',
  },
  {
    atomicNumber: 28,
    symbol: 'Ni',
    nameVi: 'Niken',
    nameEn: 'Nickel',
    shells: [2, 8, 16, 2],
    funFact:
      'Cùng với sắt tạo nên lõi trong của Trái Đất và là thành phần đặc trưng của các thiên thạch kim loại rơi xuống từ vũ trụ.',
  },
  {
    atomicNumber: 29,
    symbol: 'Cu',
    nameVi: 'Đồng',
    nameEn: 'Copper',
    shells: [2, 8, 18, 1],
    funFact:
      'Một trong hai kim loại duy nhất không có màu bạc xám tự nhiên (cùng với vàng) và là chất dẫn điện, dẫn nhiệt hàng đầu.',
  },
  {
    atomicNumber: 30,
    symbol: 'Zn',
    nameVi: 'Kẽm',
    nameEn: 'Zinc',
    shells: [2, 8, 18, 2],
    funFact:
      'Bảo vệ thép khỏi ăn mòn bằng cơ chế điện hóa và tham gia vào hoạt động của hơn 300 loại enzyme trong cơ thể người.',
  },
  {
    atomicNumber: 31,
    symbol: 'Ga',
    nameVi: 'Gali',
    nameEn: 'Gallium',
    shells: [2, 8, 18, 3],
    funFact:
      'Rắn ở nhiệt độ phòng nhưng có thể tan chảy ngay trong lòng bàn tay (29,76 °C) và là vật liệu cốt lõi của đèn LED xanh lam.',
  },
  {
    atomicNumber: 32,
    symbol: 'Ge',
    nameVi: 'Gemani',
    nameEn: 'Germanium',
    shells: [2, 8, 18, 4],
    funFact:
      'Là chất bán dẫn tạo nên chiếc transistor đầu tiên của lịch sử năm 1947 và trong suốt với tia hồng ngoại.',
  },
  {
    atomicNumber: 33,
    symbol: 'As',
    nameVi: 'Asen',
    nameEn: 'Arsenic',
    shells: [2, 8, 18, 5],
    funFact:
      'Khi kết hợp với gali tạo thành bán dẫn GaAs có tốc độ chuyển mạch điện tử nhanh hơn nhiều lần so với silic.',
  },
  {
    atomicNumber: 34,
    symbol: 'Se',
    nameVi: 'Selen',
    nameEn: 'Selenium',
    shells: [2, 8, 18, 6],
    funFact:
      'Độ dẫn điện tăng mạnh khi chiếu sáng — đặc tính quang dẫn giúp đặt nền móng cho máy photocopy và cảm biến ánh sáng đầu tiên.',
  },
  {
    atomicNumber: 35,
    symbol: 'Br',
    nameVi: 'Brom',
    nameEn: 'Bromine',
    shells: [2, 8, 18, 7],
    funFact:
      'Phi kim duy nhất tồn tại ở trạng thái lỏng ở điều kiện phòng, mang sắc nâu đỏ đặc trưng.',
  },
  {
    atomicNumber: 36,
    symbol: 'Kr',
    nameVi: 'Kripton',
    nameEn: 'Krypton',
    shells: [2, 8, 18, 8],
    funFact:
      'Bước sóng vạch quang phổ đỏ cam của kripton-86 từng được chọn làm chuẩn định nghĩa quốc tế cho 1 mét từ năm 1960 đến 1983.',
  },
];

/**
 * Matches an ordered array of electron counts per shell (1 shell = 1 chapter,
 * electrons = lessons in that chapter) against real ground-state chemical elements.
 * Returns null if the shell layout does not correspond to a real element.
 */
export function matchRealElement(shellElectronCounts: readonly number[]): PeriodicElement | null {
  if (shellElectronCounts.length === 0) return null;
  if (shellElectronCounts.some(count => !Number.isInteger(count) || count <= 0)) return null;

  for (const element of PERIODIC_ELEMENTS) {
    if (element.shells.length !== shellElectronCounts.length) continue;
    let exact = true;
    for (let i = 0; i < element.shells.length; i++) {
      if (element.shells[i] !== shellElectronCounts[i]) {
        exact = false;
        break;
      }
    }
    if (exact) return element;
  }

  return null;
}
