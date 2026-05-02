
export interface DemoLocaleNames {
  teacherFirstName: string;
  teacherLastName: string;
  students: Array<{
    firstName: string;
    lastName: string;
    email: string;
  }>;
}

const DEMO_LOCALES: Record<string, DemoLocaleNames> = {
  PL: {
    teacherFirstName: 'Anna',
    teacherLastName: 'Nowak',
    students: [
      { firstName: 'Katarzyna', lastName: 'Wiśniewska', email: 'k.wisniewska@example.com' },
      { firstName: 'Tomasz', lastName: 'Kowalczyk', email: 't.kowalczyk@example.com' },
      { firstName: 'Magdalena', lastName: 'Zielińska', email: 'm.zielinska@example.com' },
    ],
  },
  DE: {
    teacherFirstName: 'Laura',
    teacherLastName: 'Müller',
    students: [
      { firstName: 'Maximilian', lastName: 'Schmidt', email: 'm.schmidt@example.com' },
      { firstName: 'Sophie', lastName: 'Weber', email: 's.weber@example.com' },
      { firstName: 'Felix', lastName: 'Bauer', email: 'f.bauer@example.com' },
    ],
  },
  ES: {
    teacherFirstName: 'María',
    teacherLastName: 'García',
    students: [
      { firstName: 'Alejandro', lastName: 'López', email: 'a.lopez@example.com' },
      { firstName: 'Sofía', lastName: 'Martínez', email: 's.martinez@example.com' },
      { firstName: 'Carlos', lastName: 'Rodríguez', email: 'c.rodriguez@example.com' },
    ],
  },
  FR: {
    teacherFirstName: 'Camille',
    teacherLastName: 'Dubois',
    students: [
      { firstName: 'Antoine', lastName: 'Lefèvre', email: 'a.lefevre@example.com' },
      { firstName: 'Chloé', lastName: 'Moreau', email: 'c.moreau@example.com' },
      { firstName: 'Lucas', lastName: 'Bernard', email: 'l.bernard@example.com' },
    ],
  },
  IT: {
    teacherFirstName: 'Giulia',
    teacherLastName: 'Rossi',
    students: [
      { firstName: 'Marco', lastName: 'Bianchi', email: 'm.bianchi@example.com' },
      { firstName: 'Francesca', lastName: 'Romano', email: 'f.romano@example.com' },
      { firstName: 'Alessandro', lastName: 'Colombo', email: 'a.colombo@example.com' },
    ],
  },
  BR: {
    teacherFirstName: 'Camila',
    teacherLastName: 'Santos',
    students: [
      { firstName: 'Lucas', lastName: 'Oliveira', email: 'l.oliveira@example.com' },
      { firstName: 'Beatriz', lastName: 'Costa', email: 'b.costa@example.com' },
      { firstName: 'Gabriel', lastName: 'Pereira', email: 'g.pereira@example.com' },
    ],
  },
  JP: {
    teacherFirstName: 'Yuki',
    teacherLastName: 'Tanaka',
    students: [
      { firstName: 'Haruto', lastName: 'Suzuki', email: 'h.suzuki@example.com' },
      { firstName: 'Sakura', lastName: 'Watanabe', email: 's.watanabe@example.com' },
      { firstName: 'Ren', lastName: 'Takahashi', email: 'r.takahashi@example.com' },
    ],
  },
  KR: {
    teacherFirstName: 'Jiyeon',
    teacherLastName: 'Kim',
    students: [
      { firstName: 'Minjun', lastName: 'Park', email: 'm.park@example.com' },
      { firstName: 'Soyeon', lastName: 'Lee', email: 's.lee@example.com' },
      { firstName: 'Junho', lastName: 'Choi', email: 'j.choi@example.com' },
    ],
  },
  TR: {
    teacherFirstName: 'Elif',
    teacherLastName: 'Yılmaz',
    students: [
      { firstName: 'Emre', lastName: 'Kaya', email: 'e.kaya@example.com' },
      { firstName: 'Zeynep', lastName: 'Demir', email: 'z.demir@example.com' },
      { firstName: 'Burak', lastName: 'Çelik', email: 'b.celik@example.com' },
    ],
  },
  NL: {
    teacherFirstName: 'Emma',
    teacherLastName: 'de Vries',
    students: [
      { firstName: 'Daan', lastName: 'Bakker', email: 'd.bakker@example.com' },
      { firstName: 'Lotte', lastName: 'Jansen', email: 'l.jansen@example.com' },
      { firstName: 'Bram', lastName: 'Visser', email: 'b.visser@example.com' },
    ],
  },
  SE: {
    teacherFirstName: 'Astrid',
    teacherLastName: 'Lindqvist',
    students: [
      { firstName: 'Erik', lastName: 'Johansson', email: 'e.johansson@example.com' },
      { firstName: 'Maja', lastName: 'Andersson', email: 'm.andersson@example.com' },
      { firstName: 'Oscar', lastName: 'Nilsson', email: 'o.nilsson@example.com' },
    ],
  },
  CZ: {
    teacherFirstName: 'Tereza',
    teacherLastName: 'Dvořáková',
    students: [
      { firstName: 'Jakub', lastName: 'Novák', email: 'j.novak@example.com' },
      { firstName: 'Eliška', lastName: 'Svobodová', email: 'e.svobodova@example.com' },
      { firstName: 'Tomáš', lastName: 'Černý', email: 't.cerny@example.com' },
    ],
  },
  RO: {
    teacherFirstName: 'Andreea',
    teacherLastName: 'Popescu',
    students: [
      { firstName: 'Alexandru', lastName: 'Ionescu', email: 'a.ionescu@example.com' },
      { firstName: 'Maria', lastName: 'Popa', email: 'm.popa@example.com' },
      { firstName: 'Andrei', lastName: 'Radu', email: 'a.radu@example.com' },
    ],
  },
  IN: {
    teacherFirstName: 'Priya',
    teacherLastName: 'Sharma',
    students: [
      { firstName: 'Arjun', lastName: 'Patel', email: 'a.patel@example.com' },
      { firstName: 'Ananya', lastName: 'Gupta', email: 'a.gupta@example.com' },
      { firstName: 'Rohan', lastName: 'Singh', email: 'r.singh@example.com' },
    ],
  },
  MX: {
    teacherFirstName: 'Valentina',
    teacherLastName: 'Hernández',
    students: [
      { firstName: 'Diego', lastName: 'Ramírez', email: 'd.ramirez@example.com' },
      { firstName: 'Camila', lastName: 'Flores', email: 'c.flores@example.com' },
      { firstName: 'Mateo', lastName: 'Torres', email: 'm.torres@example.com' },
    ],
  },
  AR: {
    teacherFirstName: 'Luciana',
    teacherLastName: 'Fernández',
    students: [
      { firstName: 'Santiago', lastName: 'Álvarez', email: 's.alvarez@example.com' },
      { firstName: 'Martina', lastName: 'Gómez', email: 'm.gomez@example.com' },
      { firstName: 'Nicolás', lastName: 'Díaz', email: 'n.diaz@example.com' },
    ],
  },
  TH: {
    teacherFirstName: 'Siriporn',
    teacherLastName: 'Srisai',
    students: [
      { firstName: 'Nattapong', lastName: 'Wongsa', email: 'n.wongsa@example.com' },
      { firstName: 'Ploy', lastName: 'Chaiyasit', email: 'p.chaiyasit@example.com' },
      { firstName: 'Tanapat', lastName: 'Sombat', email: 't.sombat@example.com' },
    ],
  },
  VN: {
    teacherFirstName: 'Linh',
    teacherLastName: 'Nguyễn',
    students: [
      { firstName: 'Minh', lastName: 'Trần', email: 'm.tran@example.com' },
      { firstName: 'Hương', lastName: 'Lê', email: 'h.le@example.com' },
      { firstName: 'Đức', lastName: 'Phạm', email: 'd.pham@example.com' },
    ],
  },
  UA: {
    teacherFirstName: 'Oksana',
    teacherLastName: 'Shevchenko',
    students: [
      { firstName: 'Dmytro', lastName: 'Bondarenko', email: 'd.bondarenko@example.com' },
      { firstName: 'Yuliia', lastName: 'Kovalenko', email: 'y.kovalenko@example.com' },
      { firstName: 'Oleksandr', lastName: 'Melnyk', email: 'o.melnyk@example.com' },
    ],
  },
  DEFAULT: {
    teacherFirstName: 'Sarah',
    teacherLastName: 'Johnson',
    students: [
      { firstName: 'Julia', lastName: 'Kowalski', email: 'j.kowalski@example.com' },
      { firstName: 'Marco', lastName: 'Rossi', email: 'm.rossi@example.com' },
      { firstName: 'Anna', lastName: 'Chen', email: 'a.chen@example.com' },
    ],
  },
};

export function getDemoLocale(countryCode: string): DemoLocaleNames {
  const upper = (countryCode || '').toUpperCase();
  return DEMO_LOCALES[upper] || DEMO_LOCALES.DEFAULT;
}

export default DEMO_LOCALES;
