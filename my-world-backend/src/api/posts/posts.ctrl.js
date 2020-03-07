import Post from '../../models/post';
import mongoose from 'mongoose';
import Joi from '@hapi/joi';

/* 
데이터 생성(게시물 생성)
POST /api/posts
  {
    title: '제목',
    body: '내용',
    tags: ['태그1', '태그1']
  }
*/
export const write = async ctx => {
  /*
  Request Body 검증 (Joi 사용)
  */
  const schema = Joi.object().keys({
    // 객체가 다음 필드를 가지고 있음을 검증.
    title: Joi.string().required(), // required()가 있으면 필수 항목.
    body: Joi.string().required(),
    tags: Joi.array()
      .items(Joi.string())
      .required(),
  });

  const result = schema.validate(ctx.request.body);
  if (result.error) {
    ctx.status = 400; // Bad Request
    return;
  }

  /*
  게시물 생성
  */
  const { title, body, tags } = ctx.request.body;

  const post = new Post({
    title,
    body,
    tags,
  });

  try {
    await post.save();
    ctx.body = post;
  } catch (e) {
    ctx.throw(500, e);
  }
};

/* 
데이터 조회(게시물 조회)
GET /api/posts
*/
export const list = async ctx => {
  /* 페이징 기능 */
  // 값이 주어지지 않았다면 기본 1, query는 문자열이므로 숫자로 변환해준다.
  const page = parseInt(ctx.query.page || '1', 10);
  if (page < 1) {
    ctx.status = 400;
    return;
  }

  try {
    const posts = await Post.find()
      .sort({ _id: -1 }) // 최신순으로 포스팅 나열하기: 내림차순 정렬
      .limit(10) // 보이는 개수 제한
      .skip((page - 1) * 10) // 페이지 1개당 10개씩 넘기기.
      .lean() // JSON 형태로 조회할 수 있도록.
      .exec();

    // 마지막 페이지 번호 커스텀 헤더로 설정
    const postCount = await Post.countDocuments().exec();
    ctx.set('Last-Page', Math.ceil(postCount / 10));

    ctx.body = posts
      // body가 200이 넘어가면 ...붙이고 문자열 자르기.
      .map(post => ({
        ...post,
        body:
          post.body.length() < 200
            ? post.body
            : `${post.body.slice(0, 200)}...`,
      }));
  } catch (e) {
    ctx.throw(500, e);
  }
};

/*
objectId 검증 미들웨어.
read, remove, update
*/
const { ObjectId } = mongoose.Types;

export const checkObjectId = (ctx, next) => {
  const { id } = ctx.params;
  if (!ObjectId.isValid(id)) {
    ctx.status = 400; // Bad Request
    return;
  }
  return next();
};

/* 
특정 데이터 조회(특정 게시물 조회)
GET /api/posts
id는 param으로 가져온다.
*/
export const read = async ctx => {
  const { id } = ctx.params;
  /*
  Request Body 검증 (Joi 사용)
  */
  const schema = Joi.object().keys({
    title: Joi.string(),
    body: Joi.string(),
    tags: Joi.array().items(Joi.string()),
  });

  const result = schema.validate(ctx.request.body);
  if (result.error) {
    ctx.status = 400; // Bad Request
    ctx.body = result.error;
    return;
  }

  /*
게시물 수정
*/
  try {
    const post = await Post.findById(id).exec();
    if (!post) {
      ctx.status = 404;
      return;
    }
    ctx.body = post;
  } catch (e) {
    ctx.throw(500, e);
  }
};

/* 
데이터 삭제
DELETE /api/posts
remove() 특정 조건 만족하는 데이터 모두 삭제 / findByIdAndRemove() id 찾아서 삭제 / findOneAndRemove() 특정 조건 만족하는 하나 삭제
*/
export const remove = async ctx => {
  const { id } = ctx.params;
  try {
    await Post.findByIdAndRemove(id).exec();
    ctx.status = 204; //삭제하고 나서 응답할 데이터 없음.
  } catch (e) {
    ctx.throw(500, e);
  }
};

/* 
데이터 수정
PATCH /api/posts
findByIdAndUpdate() id 찾아서 수정
*/
export const update = async ctx => {
  const { id } = ctx.params;
  try {
    const post = await Post.findByIdAndUpdate(id, ctx.request.body, {
      new: true, //이 값을 설정하면 업데이트 된 데이터를 반환한다.
      // false인 경우 업데이트 되기 전 데이터 반환.
    }).exec();
    if (!post) {
      ctx.status = 404;
      return;
    }
    ctx.body = post;
  } catch (e) {
    ctx.throw(500, e);
  }
};

/*
이전 코드
*/
// let postId = 1;
// const posts = [
//   {
//     id: 1,
//     title: '제목',
//     body: '내용',
//   },
// ];

// /*
// 포스트 작성
// POST /api/posts
// {title, body}
// */
// export const write = ctx => {
//   const { title, body } = ctx.request.body;
//   postId += 1;
//   const post = { id: postId, title, body };
//   posts.push(post);
//   ctx.body = post;
// };

// /*
// 포스트 조회
// GET /api/posts
// */
// export const list = ctx => {
//   ctx.body = posts;
// };

// /*
// 특정 포스트 조회
// GET /api/posts/:id
// */
// export const read = ctx => {
//   const { id } = ctx.params;
//   // 해당 id 값의 post 비교 (받아온 param은 문자열이므로 toString으로 비교)
//   const post = posts.find(p => p.id.toString() === id);
//   // post가 없다면 오류 return
//   if (!post) {
//     ctx.posts = 404;
//     ctx.body = { message: '포스트가 존재하지 않습니다.' };
//     return;
//   }
//   ctx.body = post;
// };

// /*
// 특정 포스트 제거
// DELETE /api/posts/:id
// */
// export const remove = ctx => {
//   const { id } = ctx.params;
//   // 해당 id를 가진 post가 몇 번째 index에 있는지 비교.
//   const index = posts.findIndex(p => p.id.toString() === id);
//   // post가 없다면 오류 return
//   if (index === -1) {
//     ctx.status = 404;
//     ctx.body = { message: '포스트가 존재하지 않습니다.' };
//     return;
//   }
//   // index 번째 item 제거.
//   posts.splice(index, 1);
//   ctx.status = 204; // No Content
// };

// /*
// 특정 포스트 수정(교체)
// PUT /api/posts/:id
// {title, body}
// */
// export const replace = ctx => {
//   // PUT은 통째로 교체할때 사용.
//   const { id } = ctx.params;
//   // 해당 id를 가진 post가 몇 번째 index에 있는지 비교.
//   const index = posts.findIndex(p => p.id.toString() === id);
//   // post가 없다면 오류 return
//   if (index === -1) {
//     ctx.status = 404;
//     ctx.body = { message: '포스트가 존재하지 않습니다.' };
//     return;
//   }
//   // 전체 객체 덮어 씌우기.
//   // 기존 정보 날리고 새 객체 생성
//   posts[index] = {
//     id,
//     ...ctx.request.body,
//   };
//   ctx.body = posts[index];
// };

// /*
// 포스트 수정(특정 필드 변경)
// PATCH /api/posts/:id
// {title, body}
// */
// export const update = ctx => {
//   // PATCH 메서드는 주어진 객체만 교체.
//   const { id } = ctx.params;
//   // 해당 id를 가진 post가 몇 번째 index에 있는지 비교.
//   const index = posts.findIndex(p => p.id.toString() === id);
//   // post가 없다면 오류 return
//   if (index === -1) {
//     ctx.status = 404;
//     ctx.body = { message: '포스트가 존재하지 않습니다.' };
//     return;
//   }
//   // 기존 값에 정보 덮어 씌움.
//   posts[index] = {
//     ...posts[index],
//     ...ctx.request.body,
//   };
//   ctx.body = posts[index];
// };
