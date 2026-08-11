begin;
select plan(4);
select has_type('public', 'app_role', 'app_role exists');
select has_table('public', 'user_profiles', 'profiles exists');
select has_function('public', 'complete_google_login', 'approved login function exists');
select has_function('public', 'has_app_role', 'role helper exists');
select * from finish();
rollback;
