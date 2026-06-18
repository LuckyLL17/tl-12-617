import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.join(__dirname, '../movie_ticket.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

export const initDatabase = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT,
      avatar TEXT,
      phone TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      poster TEXT,
      description TEXT,
      duration INTEGER,
      rating REAL,
      release_date TEXT,
      genre TEXT,
      director TEXT,
      cast TEXT,
      status TEXT DEFAULT 'showing',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cinemas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      district TEXT,
      phone TEXT,
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      movie_id TEXT NOT NULL,
      cinema_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      hall TEXT,
      price REAL NOT NULL,
      seats TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (movie_id) REFERENCES movies(id),
      FOREIGN KEY (cinema_id) REFERENCES cinemas(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      schedule_id TEXT NOT NULL,
      seats TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'paid',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    )
  `);

  insertInitialData();
};

const insertInitialData = () => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const adminPassword = bcrypt.hashSync('admin123', salt);
    const userPassword = bcrypt.hashSync('123456', salt);

    const insertUser = db.prepare(
      "INSERT INTO users (id, username, password, nickname, avatar, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    insertUser.run('admin-001', 'admin', adminPassword, '管理员', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', '13900139000', 'admin');
    insertUser.run('user-001', 'user1', userPassword, '测试用户', 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1', '13800138000', 'user');
  }

  const movieCount = db.prepare('SELECT COUNT(*) as count FROM movies').get() as { count: number };
  if (movieCount.count === 0) {
    const movies = [
      {
        id: 'movie-001',
        title: '流浪地球3',
        poster: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=sci-fi%20movie%20poster%20wandering%20earth%20space%20disaster&image_size=portrait_16_9',
        description: '太阳即将毁灭，人类在地球表面建造出巨大的推进器，寻找新的家园。然而宇宙之路危机四伏，为了拯救地球，流浪地球时代的年轻人再次挺身而出，展开争分夺秒的生死之战。',
        duration: 173,
        rating: 8.3,
        release_date: '2025-01-22',
        genre: '科幻/冒险/灾难',
        director: '郭帆',
        cast: '吴京,刘德华,李雪健,沙溢',
        status: 'showing'
      },
      {
        id: 'movie-002',
        title: '满江红',
        poster: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=chinese%20historical%20movie%20poster%20ancient%20warriors%20red&image_size=portrait_16_9',
        description: '南宋绍兴年间，岳飞死后四年，秦桧率兵与金国会谈。会谈前夜，金国使者死在宰相驻地，所携密信也不翼而飞。一个小兵与亲卫营副统领机缘巧合被裹挟进这巨大阴谋之中。',
        duration: 159,
        rating: 7.8,
        release_date: '2025-01-22',
        genre: '悬疑/喜剧/历史',
        director: '张艺谋',
        cast: '沈腾,易烊千玺,张译,雷佳音',
        status: 'showing'
      },
      {
        id: 'movie-003',
        title: '熊出没·重返地球',
        poster: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=animated%20movie%20poster%20bears%20space%20adventure%20cartoon&image_size=portrait_16_9',
        description: '神秘的"外星人"阿布造访狗熊岭，结识了熊二。熊二意外获得外星文明的科技力量，却也引来了反派牛夫妇的觊觎，大伙掉入了一个精心谋划的陷阱之中。',
        duration: 98,
        rating: 8.1,
        release_date: '2025-02-01',
        genre: '动画/喜剧/冒险',
        director: '林汇达',
        cast: '张伟,张秉君,谭笑',
        status: 'showing'
      },
      {
        id: 'movie-004',
        title: '蜘蛛侠：纵横宇宙',
        poster: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=spiderman%20multiverse%20movie%20poster%20colorful%20comic%20style&image_size=portrait_16_9',
        description: '迈尔斯·莫拉莱斯与关·史黛西重聚，二人穿梭多元宇宙。当他们与其他蜘蛛侠联手，却遇上了其他宇宙的威胁，迈尔斯必须与其他蜘蛛侠对决。',
        duration: 140,
        rating: 8.9,
        release_date: '2025-03-15',
        genre: '动画/动作/冒险',
        director: '乔伊姆·多斯·桑托斯',
        cast: '沙梅克·摩尔,海莉·斯坦菲尔德',
        status: 'coming'
      },
      {
        id: 'movie-005',
        title: '速度与激情11',
        poster: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=fast%20and%20furious%20movie%20poster%20cars%20racing%20action&image_size=portrait_16_9',
        description: '多姆·托莱托带领他的家人将面对他们最致命的对手。从阴影中走出来的是一位老敌人，他发誓要为血债血偿，并决心摧毁多姆所爱的一切。',
        duration: 141,
        rating: 7.5,
        release_date: '2025-04-01',
        genre: '动作/犯罪/惊悚',
        director: '路易斯·莱特里尔',
        cast: '范·迪塞尔,杰森·斯坦森,查理兹·塞隆',
        status: 'coming'
      },
      {
        id: 'movie-006',
        title: '奥本海默',
        poster: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=oppenheimer%20movie%20poster%20nuclear%20explosion%20historical%20drama&image_size=portrait_16_9',
        description: '讲述美国"原子弹之父"罗伯特·奥本海默在二战期间领导研制原子弹的历程，以及他在面临可能毁灭世界的抉择时内心的挣扎。',
        duration: 180,
        rating: 9.0,
        release_date: '2025-03-20',
        genre: '传记/剧情/历史',
        director: '克里斯托弗·诺兰',
        cast: '基里安·墨菲,艾米莉·布朗特,小罗伯特·唐尼',
        status: 'showing'
      }
    ];

    const insertMovie = db.prepare(
      "INSERT INTO movies (id, title, poster, description, duration, rating, release_date, genre, director, cast, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    movies.forEach(movie => {
      insertMovie.run(
        movie.id, movie.title, movie.poster, movie.description,
        movie.duration, movie.rating, movie.release_date, movie.genre,
        movie.director, movie.cast, movie.status
      );
    });
  }

  const cinemaCount = db.prepare('SELECT COUNT(*) as count FROM cinemas').get() as { count: number };
  if (cinemaCount.count === 0) {
    const cinemas = [
      { id: 'cinema-001', name: '万达影城（朝阳大悦城店）', address: '北京市朝阳区朝阳北路101号朝阳大悦城9层', city: '北京', district: '朝阳区', phone: '010-85523456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20cinema%20interior%20luxury%20theater%20entrance&image_size=landscape_16_9' },
      { id: 'cinema-002', name: 'CGV影城（颐堤港店）', address: '北京市朝阳区酒仙桥路18号颐堤港购物中心3层', city: '北京', district: '朝阳区', phone: '010-84263456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=luxury%20cinema%20lobby%20modern%20design&image_size=landscape_16_9' },
      { id: 'cinema-003', name: '金逸影城（中关村店）', address: '北京市海淀区中关村大街19号新中关购物中心B1层', city: '北京', district: '海淀区', phone: '010-62623456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinema%20ticket%20counter%20modern%20interior&image_size=landscape_16_9' },
      { id: 'cinema-004', name: '百老汇影城（国瑞店）', address: '北京市东城区崇文门外大街18号国瑞城购物中心7层', city: '北京', district: '东城区', phone: '010-67123456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=movie%20theater%20auditorium%20with%20red%20seats&image_size=landscape_16_9' },
      { id: 'cinema-005', name: 'UME国际影城（双井店）', address: '北京市朝阳区东三环中路富力广场7层', city: '北京', district: '朝阳区', phone: '010-58623456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=imax%20cinema%20hall%20big%20screen&image_size=landscape_16_9' },
      { id: 'cinema-006', name: '太平洋影城（王府井店）', address: '北京市东城区王府井大街88号王府井银泰in88 6层', city: '北京', district: '东城区', phone: '010-59783456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinema%20exterior%20neon%20lights%20night&image_size=landscape_16_9' },
      { id: 'cinema-007', name: '万达影城（解放碑店）', address: '重庆市渝中区解放碑民权路26号英利国际购物中心8层', city: '重庆', district: '渝中区', phone: '023-63723456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20cinema%20complex%20shopping%20mall&image_size=landscape_16_9' },
      { id: 'cinema-008', name: 'CGV影城（观音桥店）', address: '重庆市江北区观音桥步行街8号大融城购物中心7层', city: '重庆', district: '江北区', phone: '023-67723456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinema%20entrance%20with%20colorful%20lights&image_size=landscape_16_9' },
      { id: 'cinema-009', name: '金逸影城（大学城店）', address: '重庆市沙坪坝区大学城北路92号龙湖U城天街5层', city: '重庆', district: '沙坪坝区', phone: '023-65323456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20movie%20theater%20lobby&image_size=landscape_16_9' },
      { id: 'cinema-010', name: '万达影城（天河城店）', address: '广东省广州市天河区天河路208号天河城购物中心4层', city: '广州', district: '天河区', phone: '020-38323456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=luxury%20cinema%20in%20shopping%20mall&image_size=landscape_16_9' },
      { id: 'cinema-011', name: '百丽宫影城（太古汇店）', address: '广东省广州市天河区天河路383号太古汇M层', city: '广州', district: '天河区', phone: '020-38623456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=premium%20cinema%20interior%20design&image_size=landscape_16_9' },
      { id: 'cinema-012', name: 'UA影城（花城汇店）', address: '广东省广州市天河区珠江东路花城汇购物中心B1层', city: '广州', district: '天河区', phone: '020-38023456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinema%20ticket%20booth%20modern&image_size=landscape_16_9' },
      { id: 'cinema-013', name: '万达影城（杭州拱墅店）', address: '浙江省杭州市拱墅区杭行路666号万达广场4层', city: '杭州', district: '拱墅区', phone: '0571-88023456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinema%20hall%20with%20red%20seats&image_size=landscape_16_9' },
      { id: 'cinema-014', name: '百老汇影城（万象城店）', address: '浙江省杭州市上城区富春路701号万象城3层', city: '杭州', district: '上城区', phone: '0571-87923456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20cinema%20complex&image_size=landscape_16_9' },
      { id: 'cinema-015', name: '新远国际影城（西湖文化广场店）', address: '浙江省杭州市下城区西湖文化广场8号', city: '杭州', district: '下城区', phone: '0571-88123456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinema%20exterior%20night%20view&image_size=landscape_16_9' },
      { id: 'cinema-016', name: '万达影城（南京新街口店）', address: '江苏省南京市秦淮区洪武路88号新街口万达广场4层', city: '南京', district: '秦淮区', phone: '025-84723456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=movie%20theater%20modern%20lobby&image_size=landscape_16_9' },
      { id: 'cinema-017', name: '幸福蓝海国际影城（德基店）', address: '江苏省南京市玄武区中山路18号德基广场7层', city: '南京', district: '玄武区', phone: '025-86723456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=luxury%20cinema%20auditorium&image_size=landscape_16_9' },
      { id: 'cinema-018', name: '上影国际影城（五角场店）', address: '上海市杨浦区邯郸路600号万达广场5层', city: '上海', district: '杨浦区', phone: '021-65623456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinema%20in%20shanghai%20modern&image_size=landscape_16_9' },
      { id: 'cinema-019', name: '万达影城（人民广场店）', address: '上海市黄浦区南京东路300号恒基名人购物中心6层', city: '上海', district: '黄浦区', phone: '021-63523456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=shanghai%20cinema%20night&image_size=landscape_16_9' },
      { id: 'cinema-020', name: '百丽宫影城（环贸iapm店）', address: '上海市徐汇区淮海中路999号环贸iapm商场5层', city: '上海', district: '徐汇区', phone: '021-54523456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=premium%20movie%20theater&image_size=landscape_16_9' },
      { id: 'cinema-021', name: '万达影城（锦华店）', address: '四川省成都市锦江区锦华路一段68号万达广场4层', city: '成都', district: '锦江区', phone: '028-84123456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=chengdu%20cinema%20modern&image_size=landscape_16_9' },
      { id: 'cinema-022', name: '太平洋影城（春熙店）', address: '四川省成都市锦江区春熙路西段15号', city: '成都', district: '锦江区', phone: '028-86723456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinema%20entrance%20chunxi&image_size=landscape_16_9' },
      { id: 'cinema-023', name: '万达影城（解放路店）', address: '陕西省西安市新城区解放路111号万达广场4层', city: '西安', district: '新城区', phone: '029-87223456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=xian%20cinema%20modern%20interior&image_size=landscape_16_9' },
      { id: 'cinema-024', name: '博纳国际影城（大悦城店）', address: '陕西省西安市雁塔区长安中路123号赛格国际购物中心7层', city: '西安', district: '雁塔区', phone: '029-85223456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinema%20xian%20night%20view&image_size=landscape_16_9' },
      { id: 'cinema-025', name: '万达影城（楚河汉街店）', address: '湖北省武汉市武昌区中北路1号万达广场4层', city: '武汉', district: '武昌区', phone: '027-87323456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=wuhan%20cinema%20modern&image_size=landscape_16_9' },
      { id: 'cinema-026', name: 'CGV影城（江汉路店）', address: '湖北省武汉市江汉区江汉路118号港澳中心6层', city: '武汉', district: '江汉区', phone: '027-82723456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinema%20jianghan%20road&image_size=landscape_16_9' },
      { id: 'cinema-027', name: '万达影城（CBD店）', address: '河南省郑州市金水区郑汴路127号万达广场4层', city: '郑州', district: '金水区', phone: '0371-65523456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=zhengzhou%20cinema%20modern&image_size=landscape_16_9' },
      { id: 'cinema-028', name: '奥斯卡国际影城（曼哈顿店）', address: '河南省郑州市金水区未来路曼哈顿广场5层', city: '郑州', district: '金水区', phone: '0371-65923456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cinema%20lobby%20zhengzhou&image_size=landscape_16_9' },
      { id: 'cinema-029', name: '万达影城（东港店）', address: '辽宁省大连市中山区长江东路96号万达广场4层', city: '大连', district: '中山区', phone: '0411-82723456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=dalian%20cinema%20seaside&image_size=landscape_16_9' },
      { id: 'cinema-030', name: '万达影城（李沧店）', address: '山东省青岛市李沧区巨峰路179号万达广场4层', city: '青岛', district: '李沧区', phone: '0532-67723456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=qingdao%20cinema%20modern&image_size=landscape_16_9' },
      { id: 'cinema-031', name: '万达影城（仓山店）', address: '福建省福州市仓山区浦上大道276号万达广场4层', city: '福州', district: '仓山区', phone: '0591-87923456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=fuzhou%20cinema%20interior&image_size=landscape_16_9' },
      { id: 'cinema-032', name: '万达影城（红谷滩店）', address: '江西省南昌市红谷滩区会展路999号万达广场4层', city: '南昌', district: '红谷滩区', phone: '0791-83723456', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=nanchang%20cinema%20modern&image_size=landscape_16_9' }
    ];

    const insertCinema = db.prepare(
      "INSERT INTO cinemas (id, name, address, city, district, phone, image) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    cinemas.forEach(cinema => {
      insertCinema.run(cinema.id, cinema.name, cinema.address, cinema.city, cinema.district, cinema.phone, cinema.image);
    });
  }

  const scheduleCount = db.prepare('SELECT COUNT(*) as count FROM schedules').get() as { count: number };
  if (scheduleCount.count === 0) {
    const baseDate = new Date().toISOString().split('T')[0];
    const timeSlots = ['09:00', '11:30', '14:00', '16:30', '19:00', '21:30'];
    const halls = ['1号激光厅', '2号激光厅', '3号厅', 'IMAX厅', '杜比全景声厅', 'VIP厅'];
    const basePrices = [45, 55, 58, 68, 78, 98, 108, 128];
    
    const movies = ['movie-001', 'movie-002', 'movie-003', 'movie-004', 'movie-005', 'movie-006'];
    const cinemas = ['cinema-001', 'cinema-002', 'cinema-003', 'cinema-004', 'cinema-005', 'cinema-006', 'cinema-007', 'cinema-008', 'cinema-010', 'cinema-013', 'cinema-016', 'cinema-018', 'cinema-021', 'cinema-023', 'cinema-025', 'cinema-027'];
    
    const schedules: any[] = [];
    let schedId = 1;
    
    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().split('T')[0];
      
      movies.forEach((movieId, movieIdx) => {
        cinemas.forEach((cinemaId, cinemaIdx) => {
          const numSchedules = Math.floor(Math.random() * 3) + 2;
          const selectedSlots = [...timeSlots].sort(() => Math.random() - 0.5).slice(0, numSchedules);
          
          selectedSlots.forEach((time, slotIdx) => {
            const hour = parseInt(time.split(':')[0]);
            const movieDuration = [173, 159, 98, 140, 141, 180][movieIdx];
            const endHour = hour + Math.floor(movieDuration / 60);
            const endMin = Math.floor(movieDuration % 60);
            const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
            
            const priceIdx = (movieIdx + cinemaIdx + slotIdx + dayOffset) % basePrices.length;
            const hallIdx = (cinemaIdx + slotIdx) % halls.length;
            
            schedules.push({
              id: `sched-${String(schedId).padStart(3, '0')}`,
              movie_id: movieId,
              cinema_id: cinemaId,
              start_time: `${dateStr} ${time}`,
              end_time: `${dateStr} ${endTime}`,
              hall: halls[hallIdx],
              price: basePrices[priceIdx],
              seats: generateSeats()
            });
            schedId++;
          });
        });
      });
    }

    const insertSchedule = db.prepare(
      "INSERT INTO schedules (id, movie_id, cinema_id, start_time, end_time, hall, price, seats) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    schedules.forEach(sched => {
      insertSchedule.run(sched.id, sched.movie_id, sched.cinema_id, sched.start_time, sched.end_time, sched.hall, sched.price, sched.seats);
    });
  }
};

/**
 * 生成初始座位数据
 * @returns 座位数据的 JSON 字符串
 */
function generateSeats(): string {
  const rows = 8;
  const cols = 12;
  const seats: { [key: string]: { available: boolean; sold: boolean; locked: boolean; locked_by: string | null; locked_until: string | null } } = {};
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seatId = `${String.fromCharCode(65 + r)}${c + 1}`;
      const random = Math.random();
      seats[seatId] = {
        available: true,
        sold: random < 0.2,
        locked: false,
        locked_by: null,
        locked_until: null
      };
    }
  }
  
  return JSON.stringify(seats);
}

export default db;
